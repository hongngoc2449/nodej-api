const express = require("express");
const router = express.Router();
const axios = require("axios");

// Helpers to interact with Lark (Feishu) Open Platform
async function getTenantAccessToken() {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Missing LARK_APP_ID or LARK_APP_SECRET in environment");
  }
  const url =
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal";
  const resp = await axios.post(url, { app_id: appId, app_secret: appSecret });
  if (resp.data.code !== 0) {
    throw new Error(
      `Get tenant_access_token failed: ${resp.data.msg || resp.data.code}`
    );
  }
  return resp.data.tenant_access_token;
}

// Send a text message to a user/chat in Lark
// Priority of identifiers: chat_id > open_id > user_id > email
async function sendLarkTextMessage({ chat_id, open_id, user_id, email, text }) {
  if (!text) throw new Error("text is required");

  // Decide receive_id_type and receive_id
  let receive_id_type = "";
  let receive_id = "";
  if (chat_id) {
    receive_id_type = "chat_id";
    receive_id = chat_id;
  } else if (open_id) {
    receive_id_type = "open_id";
    receive_id = open_id;
  } else if (user_id) {
    receive_id_type = "user_id";
    receive_id = user_id;
  } else if (email) {
    receive_id_type = "email";
    receive_id = email;
  } else {
    throw new Error("One of chat_id, open_id, user_id, email is required");
  }

  const token = await getTenantAccessToken();
  const url = `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=${receive_id_type}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const body = {
    receive_id,
    msg_type: "text",
    content: JSON.stringify({ text }),
  };
  const resp = await axios.post(url, body, { headers });
  if (resp.data.code !== 0) {
    throw new Error(`Send message failed: ${resp.data.msg || resp.data.code}`);
  }
  return resp.data;
}

function inferReceiveIdType(receive_id) {
  if (!receive_id) return "";
  if (receive_id.includes("@")) return "email";
  if (receive_id.startsWith("oc_")) return "chat_id";
  if (receive_id.startsWith("ou_")) return "open_id";
  return "user_id";
}

// Health check
router.get("/lark/ping", async (req, res) => {
  try {
    res.json({ success: true, message: "Lark route is alive" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /lark/send
// Two modes supported:
// 1) Raw mode: { receive_id, msg_type, content, uuid?, receive_id_type? }
// 2) Simple mode: { chat_id?, open_id?, user_id?, email?, text }
router.post("/lark/send", async (req, res) => {
  try {
    const {
      receive_id,
      msg_type,
      content,
      uuid,
      receive_id_type,
      chat_id,
      open_id,
      user_id,
      email,
      text,
    } = req.body || {};

    if (receive_id) {
      const token = await getTenantAccessToken();
      const type = receive_id_type || inferReceiveIdType(receive_id);
      if (!type) throw new Error("Unable to determine receive_id_type");
      const url = `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=${type}`;
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const payload = {
        receive_id,
        msg_type: msg_type || "text",
        content:
          typeof content === "string" ? content : JSON.stringify(content || {}),
      };
      if (uuid) payload.uuid = uuid;
      const resp = await axios.post(url, payload, { headers });
      if (resp.data.code !== 0) {
        throw new Error(
          `Send message failed: ${resp.data.msg || resp.data.code}`
        );
      }
      return res.json({ success: true, result: resp.data });
    }

    const result = await sendLarkTextMessage({
      chat_id,
      open_id,
      user_id,
      email,
      text,
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error("Lark send error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
