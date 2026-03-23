const express = require("express");
const axios = require("axios");

const router = express.Router();
const SHOPIFY_API_VERSION = (process.env.SHOPIFY_API_VERSION || "2025-10").trim();

const PRODUCT_CREATE_MUTATION = `
mutation CreateProduct($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product {
      id
      title
      handle
      options {
        id
        name
        position
        optionValues {
          id
          name
          hasVariants
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const PRODUCT_VARIANTS_BULK_CREATE_MUTATION = `
mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
  productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
    productVariants {
      id
      title
      price
      compareAtPrice
      inventoryPolicy
      inventoryItem {
        id
        sku
      }
      selectedOptions {
        name
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const PRODUCT_CREATE_MEDIA_MUTATION = `
mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media {
      id
      status
      mediaContentType
    }
    mediaUserErrors {
      field
      message
    }
  }
}
`;

const METAFIELDS_SET_MUTATION = `
mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      namespace
      key
      type
      value
    }
    userErrors {
      field
      message
      code
    }
  }
}
`;

const SHOP_LOCATIONS_QUERY = `
query ShopLocations($first: Int!) {
  locations(first: $first) {
    nodes {
      id
      name
    }
  }
}
`;

const SHOP_PUBLICATIONS_QUERY = `
query ShopPublications($first: Int!) {
  publications(first: $first) {
    nodes {
      id
      name
    }
  }
}
`;

const PUBLISHABLE_PUBLISH_MUTATION = `
mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable {
      ... on Product {
        id
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

async function fetchShopifyAccessToken({ shop, grantType, clientId, clientSecret }) {
  const endpoint = `https://${shop}.myshopify.com/admin/oauth/access_token`;

  const response = await axios.post(endpoint, {
    grant_type: grantType,
    client_id: clientId,
    client_secret: clientSecret,
  });

  return response.data;
}

async function callShopifyGraphQL({ shop, accessToken, query, variables }) {
  const endpoint = `https://${shop}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await axios.post(
    endpoint,
    {
      query,
      ...(variables ? { variables } : {}),
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    }
  );

  return response.data;
}

function toShopifyStatus(status) {
  if (!status || typeof status !== "string") return undefined;
  const normalized = status.trim().toUpperCase();
  if (["ACTIVE", "DRAFT", "ARCHIVED"].includes(normalized)) {
    return normalized;
  }
  return undefined;
}

function normalizeProductFromBody(body) {
  if (body && body.product && typeof body.product === "object") {
    return body.product;
  }
  return body || {};
}

function mapProductOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return undefined;

  const mapped = options
    .filter((item) => item && typeof item.name === "string" && item.name.trim() !== "")
    .map((item) => ({
      name: item.name.trim(),
      ...(Array.isArray(item.values) && item.values.length
        ? {
            values: item.values
              .filter((value) => typeof value === "string" && value.trim() !== "")
              .map((value) => ({ name: value.trim() })),
          }
        : {}),
    }));

  return mapped.length ? mapped : undefined;
}

function mapVariants(variants, optionDefs, locationId) {
  if (!Array.isArray(variants) || variants.length === 0) return [];

  return variants.map((variant) => {
    const optionValues = [];

    if (Array.isArray(optionDefs)) {
      for (let index = 0; index < optionDefs.length && index < 3; index += 1) {
        const optionName = optionDefs[index] && optionDefs[index].name;
        const rawValue = variant && variant[`option${index + 1}`];

        if (
          typeof optionName === "string" &&
          optionName.trim() !== "" &&
          typeof rawValue === "string" &&
          rawValue.trim() !== ""
        ) {
          optionValues.push({
            optionName: optionName.trim(),
            name: rawValue.trim(),
          });
        }
      }
    }

    const rawPrice = variant && variant.price != null ? Number(variant.price) : null;
    const rawCompareAt =
      variant && variant.compare_at_price != null ? Number(variant.compare_at_price) : null;

    const hasValidPrice = Number.isFinite(rawPrice) && rawPrice >= 0;
    const hasValidCompareAt =
      Number.isFinite(rawCompareAt) && rawCompareAt > 0 && (!hasValidPrice || rawCompareAt >= rawPrice);

    const mapped = {
      ...(variant && variant.price != null ? { price: String(variant.price) } : {}),
      ...(hasValidCompareAt ? { compareAtPrice: String(rawCompareAt) } : {}),
      ...(optionValues.length ? { optionValues } : {}),
    };

    if (variant && variant.sku) {
      mapped.inventoryItem = {
        sku: String(variant.sku),
        tracked: variant.inventory_management === "shopify",
      };
    }

    if (variant && typeof variant.inventory_policy === "string") {
      const policy = variant.inventory_policy.trim().toUpperCase();
      if (policy === "DENY" || policy === "CONTINUE") {
        mapped.inventoryPolicy = policy;
      }
    }

    const quantityNumber = Number(variant && variant.inventory_quantity);
    if (locationId && Number.isFinite(quantityNumber)) {
      mapped.inventoryQuantities = [
        {
          locationId,
          availableQuantity: Math.max(0, Math.trunc(quantityNumber)),
        },
      ];
    }

    return mapped;
  });
}

function isHandleConflictError(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return false;

  return errors.some((error) => {
    const message = (error && error.message ? String(error.message) : "").toLowerCase();
    const fieldPath = Array.isArray(error && error.field)
      ? error.field.map((part) => String(part).toLowerCase()).join(".")
      : "";

    return (
      fieldPath.includes("handle") ||
      message.includes("handle") ||
      message.includes("already been taken")
    );
  });
}

function makeRetryHandle(baseHandle, title) {
  const candidate = (typeof baseHandle === "string" && baseHandle.trim())
    ? baseHandle.trim()
    : String(title || "product")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const compactCandidate = (candidate || "product").slice(0, 80);
  const timePart = Date.now().toString(36).slice(-6);
  const randomPart = Math.random().toString(36).slice(2, 6);
  return `p-${timePart}${randomPart}-${compactCandidate}`;
}

function mapImageMediaInputs(images) {
  if (!Array.isArray(images) || images.length === 0) return [];

  return images
    .filter((item) => typeof item === "string" && item.trim() !== "")
    .map((src) => ({
      originalSource: src.trim(),
      mediaContentType: "IMAGE",
    }));
}

function mapMetafields(metafields, ownerId) {
  if (!ownerId || !Array.isArray(metafields) || metafields.length === 0) return [];

  return metafields
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const namespace = typeof item.namespace === "string" ? item.namespace.trim() : "";
      const key = typeof item.key === "string" ? item.key.trim() : "";
      const type = typeof item.type === "string" ? item.type.trim() : "";
      const value = item.value != null ? String(item.value) : "";

      if (!namespace || !key || !type) return null;

      return {
        ownerId,
        namespace,
        key,
        type,
        value,
      };
    })
    .filter(Boolean);
}

async function resolveShopifyLocationId({ shop, accessToken }) {
  const explicitLocationId = (process.env.SHOPIFY_LOCATION_ID || "").trim();
  if (explicitLocationId) {
    return explicitLocationId;
  }

  const locationsResult = await callShopifyGraphQL({
    shop,
    accessToken,
    query: SHOP_LOCATIONS_QUERY,
    variables: { first: 1 },
  });

  return (
    (locationsResult &&
      locationsResult.data &&
      locationsResult.data.locations &&
      locationsResult.data.locations.nodes &&
      locationsResult.data.locations.nodes[0] &&
      locationsResult.data.locations.nodes[0].id) ||
    null
  );
}

async function resolveShopifyPublications({ shop, accessToken }) {
  const result = await callShopifyGraphQL({
    shop,
    accessToken,
    query: SHOP_PUBLICATIONS_QUERY,
    variables: { first: 250 },
  });

  const publications =
    (result &&
      result.data &&
      result.data.publications &&
      Array.isArray(result.data.publications.nodes)
      ? result.data.publications.nodes
      : []) || [];

  const graphqlErrors = (result && result.errors) || [];

  return { publications, graphqlErrors, raw: result };
}

async function publishProductToAllChannels({ shop, accessToken, productId, publicationIds }) {
  if (!productId || !Array.isArray(publicationIds) || publicationIds.length === 0) {
    return { publishResult: null, publishUserErrors: [], publishGraphqlErrors: [] };
  }

  const input = publicationIds
    .filter((id) => typeof id === "string" && id.trim() !== "")
    .map((id) => ({ publicationId: id.trim() }));

  if (input.length === 0) {
    return { publishResult: null, publishUserErrors: [], publishGraphqlErrors: [] };
  }

  const publishResult = await callShopifyGraphQL({
    shop,
    accessToken,
    query: PUBLISHABLE_PUBLISH_MUTATION,
    variables: {
      id: productId,
      input,
    },
  });

  const publishUserErrors =
    (publishResult &&
      publishResult.data &&
      publishResult.data.publishablePublish &&
      publishResult.data.publishablePublish.userErrors) ||
    [];

  const publishGraphqlErrors = (publishResult && publishResult.errors) || [];

  return {
    publishResult,
    publishUserErrors,
    publishGraphqlErrors,
  };
}

router.post("/shopify/token", async (req, res) => {
  try {
    const { shop, grant_type, client_id, client_secret } = req.body;
    const grantType = grant_type || "client_credentials";

    if (!shop || shop.trim() === "") {
      return res.status(400).json({ error: "shop is required" });
    }

    if (!client_id || client_id.trim() === "") {
      return res.status(400).json({ error: "client_id is required" });
    }

    if (!client_secret || client_secret.trim() === "") {
      return res.status(400).json({ error: "client_secret is required" });
    }

    const tokenData = await fetchShopifyAccessToken({
      shop: shop.trim(),
      grantType,
      clientId: client_id.trim(),
      clientSecret: client_secret.trim(),
    });

    return res.json({
      success: true,
      shop: shop.trim(),
      data: tokenData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Shopify Token API Error:", error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data && error.response.data.error
          ? error.response.data.error
          : "Failed to get Shopify access token",
        details: error.response.data,
      });
    }

    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
});

router.post("/shopify/product", async (req, res) => {
  try {
    const payload = normalizeProductFromBody(req.body);
    const rootBody = req.body || {};
    const {
      shop,
      access_token,
      title,
      product_options,
      body_html,
      vendor,
      handle,
      status,
      product_type,
      tags,
      options,
      variants,
      images,
      metafields,
    } = payload;

    const accessToken =
      access_token ||
      (req.body && req.body.access_token) ||
      req.header("X-Shopify-Access-Token");

    const shopName = (shop || (req.body && req.body.shop) || process.env.SHOPIFY_SHOP || "").trim();

    if (!shopName) {
      return res.status(400).json({ error: "shop is required (or set SHOPIFY_SHOP in .env)" });
    }

    // Get access token - either provided or fetch it using client credentials
    let finalAccessToken = accessToken ? accessToken.trim() : "";

    if (!finalAccessToken) {
      const { client_id, client_secret, grant_type } = req.body;

      if (client_id && client_secret) {
        try {
          console.log(`Fetching Shopify access token for shop: ${shopName}`);
          const tokenData = await fetchShopifyAccessToken({
            shop: shopName,
            grantType: grant_type || "client_credentials",
            clientId: client_id.trim(),
            clientSecret: client_secret.trim(),
          });

          finalAccessToken = tokenData.access_token;
          console.log(`Successfully obtained access token for shop: ${shopName}`);
        } catch (error) {
          console.error("Failed to fetch Shopify access token:", error.message);
          return res.status(400).json({
            error: "Failed to get Shopify access token",
            details: error.message || error.response?.data || "Unknown error",
          });
        }
      } else {
        return res.status(400).json({
          error:
            "access_token (or X-Shopify-Access-Token header) is required, or provide client_id and client_secret to auto-fetch token",
        });
      }
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "title is required" });
    }

    if (product_options && !Array.isArray(product_options) && !Array.isArray(options)) {
      return res.status(400).json({ error: "product_options/options must be an array" });
    }

    if (variants && !Array.isArray(variants)) {
      return res.status(400).json({ error: "variants must be an array" });
    }

    const rootImages = Array.isArray(rootBody.images) ? rootBody.images : [];
    const payloadImages = Array.isArray(images) ? images : [];
    const mediaImages = payloadImages.length ? payloadImages : rootImages;

    const optionSource = Array.isArray(product_options) ? product_options : options;
    const productOptions = mapProductOptions(optionSource);
    const shopifyStatus = toShopifyStatus(status);

    let productInput = {
      title: title.trim(),
      ...(body_html ? { descriptionHtml: body_html } : {}),
      ...(vendor ? { vendor } : {}),
      ...(handle ? { handle } : {}),
      ...(product_type ? { productType: product_type } : {}),
      ...(Array.isArray(tags) ? { tags: tags.map((tag) => String(tag)) } : {}),
      ...(shopifyStatus ? { status: shopifyStatus } : {}),
      ...(productOptions ? { productOptions } : {}),
    };

    let createResult = await callShopifyGraphQL({
      shop: shopName,
      accessToken: finalAccessToken,
      query: PRODUCT_CREATE_MUTATION,
      variables: { product: productInput },
    });

    let createErrors =
      (createResult &&
        createResult.data &&
        createResult.data.productCreate &&
        createResult.data.productCreate.userErrors) ||
      [];
    const topLevelGraphqlErrors = (createResult && createResult.errors) || [];

    if (topLevelGraphqlErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Shopify GraphQL error when creating product",
        graphqlErrors: topLevelGraphqlErrors,
        data: createResult,
      });
    }

    const attemptedHandles = [];
    if (productInput && productInput.handle) {
      attemptedHandles.push(productInput.handle);
    }

    let retryCount = 0;
    while (createErrors.length > 0 && isHandleConflictError(createErrors) && retryCount < 3) {
      const retryHandle = makeRetryHandle(productInput && productInput.handle ? productInput.handle : handle, title);
      productInput = {
        ...productInput,
        handle: retryHandle,
      };
      attemptedHandles.push(retryHandle);

      createResult = await callShopifyGraphQL({
        shop: shopName,
        accessToken: finalAccessToken,
        query: PRODUCT_CREATE_MUTATION,
        variables: { product: productInput },
      });

      createErrors =
        (createResult &&
          createResult.data &&
          createResult.data.productCreate &&
          createResult.data.productCreate.userErrors) ||
        [];

      retryCount += 1;
    }

    if (createErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Shopify validation failed when creating product",
        userErrors: createErrors,
        ...(attemptedHandles.length ? { attemptedHandles } : {}),
        data: createResult,
      });
    }

    const createdProduct = createResult && createResult.data && createResult.data.productCreate
      ? createResult.data.productCreate.product
      : null;

    let variantsResult = null;
    let variantUserErrors = [];
    let mediaResult = null;
    let mediaUserErrors = [];
    let metafieldsResult = null;
    let metafieldUserErrors = [];
    let publicationResolveResult = null;
    let publishResult = null;
    let publishUserErrors = [];
    let publishGraphqlErrors = [];
    let inventoryLocationId = null;

    if (createdProduct && createdProduct.id && Array.isArray(variants) && variants.length > 0) {
      inventoryLocationId = await resolveShopifyLocationId({
        shop: shopName,
        accessToken: finalAccessToken,
      });

      const mappedVariants = mapVariants(variants, optionSource || [], inventoryLocationId);

      if (mappedVariants.length > 0) {
        variantsResult = await callShopifyGraphQL({
          shop: shopName,
          accessToken: finalAccessToken,
          query: PRODUCT_VARIANTS_BULK_CREATE_MUTATION,
          variables: {
            productId: createdProduct.id,
            variants: mappedVariants,
            strategy: "REMOVE_STANDALONE_VARIANT",
          },
        });

        variantUserErrors =
          (variantsResult &&
            variantsResult.data &&
            variantsResult.data.productVariantsBulkCreate &&
            variantsResult.data.productVariantsBulkCreate.userErrors) ||
          [];
      }
    }

    if (createdProduct && createdProduct.id && mediaImages.length > 0) {
      const mediaInputs = mapImageMediaInputs(mediaImages);

      if (mediaInputs.length > 0) {
        mediaResult = await callShopifyGraphQL({
          shop: shopName,
          accessToken: finalAccessToken,
          query: PRODUCT_CREATE_MEDIA_MUTATION,
          variables: {
            productId: createdProduct.id,
            media: mediaInputs,
          },
        });

        mediaUserErrors =
          (mediaResult &&
            mediaResult.data &&
            mediaResult.data.productCreateMedia &&
            mediaResult.data.productCreateMedia.mediaUserErrors) ||
          [];
      }
    }

    if (createdProduct && createdProduct.id && Array.isArray(metafields) && metafields.length > 0) {
      const mappedMetafields = mapMetafields(metafields, createdProduct.id);

      if (mappedMetafields.length > 0) {
        metafieldsResult = await callShopifyGraphQL({
          shop: shopName,
          accessToken: finalAccessToken,
          query: METAFIELDS_SET_MUTATION,
          variables: {
            metafields: mappedMetafields,
          },
        });

        metafieldUserErrors =
          (metafieldsResult &&
            metafieldsResult.data &&
            metafieldsResult.data.metafieldsSet &&
            metafieldsResult.data.metafieldsSet.userErrors) ||
          [];
      }
    }

    if (createdProduct && createdProduct.id) {
      publicationResolveResult = await resolveShopifyPublications({
        shop: shopName,
        accessToken: finalAccessToken,
      });

      const publicationIds = Array.isArray(publicationResolveResult && publicationResolveResult.publications)
        ? publicationResolveResult.publications.map((item) => item && item.id).filter(Boolean)
        : [];

      const publishData = await publishProductToAllChannels({
        shop: shopName,
        accessToken: finalAccessToken,
        productId: createdProduct.id,
        publicationIds,
      });

      publishResult = publishData.publishResult;
      publishUserErrors = Array.isArray(publishData.publishUserErrors) ? publishData.publishUserErrors : [];
      publishGraphqlErrors = Array.isArray(publishData.publishGraphqlErrors)
        ? publishData.publishGraphqlErrors
        : [];
    }

    const publicationResolveErrors =
      (publicationResolveResult && Array.isArray(publicationResolveResult.graphqlErrors)
        ? publicationResolveResult.graphqlErrors
        : []) || [];

    const publishGraphqlErrorsAsUserErrors = publishGraphqlErrors.map((error) => ({
      field: ["publishablePublish"],
      message: error && error.message ? error.message : JSON.stringify(error),
    }));

    const publicationResolveErrorsAsUserErrors = publicationResolveErrors.map((error) => ({
      field: ["publications"],
      message: error && error.message ? error.message : JSON.stringify(error),
    }));

    const allUserErrors = [
      ...variantUserErrors,
      ...mediaUserErrors,
      ...metafieldUserErrors,
      ...publishUserErrors,
      ...publishGraphqlErrorsAsUserErrors,
      ...publicationResolveErrorsAsUserErrors,
    ];

    return res.json({
      success: allUserErrors.length === 0,
      shop: shopName,
      ...(inventoryLocationId ? { inventoryLocationId } : {}),
      input: productInput,
      data: {
        productCreate: createResult,
        ...(variantsResult ? { variantsBulkCreate: variantsResult } : {}),
        ...(mediaResult ? { mediaCreate: mediaResult } : {}),
        ...(metafieldsResult ? { metafieldsSet: metafieldsResult } : {}),
        ...(publicationResolveResult ? { publications: publicationResolveResult } : {}),
        ...(publishResult ? { publishAllChannels: publishResult } : {}),
      },
      ...(allUserErrors.length ? { userErrors: allUserErrors } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Shopify Product API Error:", error.message);

    if (error.response) {
      const upstream = error.response.data || {};
      const upstreamMessage =
        (upstream && upstream.error) ||
        (Array.isArray(upstream.errors) && upstream.errors.length
          ? upstream.errors.map((item) => item.message || JSON.stringify(item)).join("; ")
          : null) ||
        error.message;

      return res.status(error.response.status).json({
        success: false,
        error: upstreamMessage || "Failed to create Shopify product",
        details: upstream,
        statusCode: error.response.status,
        apiVersion: SHOPIFY_API_VERSION,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      apiVersion: SHOPIFY_API_VERSION,
    });
  }
});

module.exports = router;