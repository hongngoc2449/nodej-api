import json
import requests
import math
import re
from gpt import *
import threading

color = {
  "BLC": "Black",
  "WTE": "White",
  "MIT": "Mint",
  "DBS": "Deep Blue Spruce",
  "NTR": "Natural",
  "DGH": "Dark Grey Heather",
  "SPG": "Sport Grey",
  "BLU": "Blue",
  "YLW": "Yellow",
  "ORG": "Orange",
  "PNK": "Pink",
  "LMV": "Light Mauve",
  "MAV": "Light Mauve",
  "BRN": "Brown",
  "NAV": "Navy",
  "ASH": "Ash Heather",
  "VPW": "Vintage Purple Wash",
  "VGW": "Vintage Gray Wash",
}

size = {
    "NB": "Newborn",
    "NB1": "Only",
    "NB2": "+ Hat", 
    "03": "0-3M",
    "36": "3-6M",
    "612": "6-12M",
    "1218": "12-18M",
    "1824": "18-24M",
    "2T": "2T", 
    "3T": "3T",
    "4T": "4T",
    "5T": "5T",
    "6T": "6T",
    "56T": "5-6T",
    "7T": "7T",
    "S": "S",
    "M": "M",
    "L": "L",
    "XL": "XL",
    "2XL": "2XL",    
}


products = [
    {
        "name":"Long Sleeve Romper",
        "code":"4",
        "size":["03","36","612","1218","1824"],
        "color":["NTR","WTE","NAV","LMV","BRN"],
        "price":19,
        "price_step":1
    },
    {
        "name":"Kids' Sweatshirt",
        "code":"3",
        "size":["2T","3T","4T","5T","6T"],
        "color":["NTR","WTE","SPG","BRN"],
        "price":19,
        "price_step":1
    },
    {
        "name":"Adult's Sweatshirt",
        "code":"2",
        "size":["S","M","L","XL","2XL"],
        "color":["NTR","WTE","SPG","BRN"],
        "price":28,
        "price_step":2
    },
    {
        "name":"Kids' T-Shirt",
        "code":"7",
        "size":["2T","3T","4T","56T","7T"],
        "color":["NTR","BLC","WTE","SPG","LMV"],
        "price":19,
        "price_step":1
    },
    {
        "name":"Adult's T-Shirt",
        "code":"1",
        "size":["S","M","L","XL","2XL"],
        "color":["NTR","BLC","WTE","DGH","LMV","MIT","DBS"],
        "price":22,
        "price_step":1
    },
    {
        "name":"Short Sleeve Romper",
        "code":"8",
        "size":["03","36","612","1218","1824"],
        "color":["NTR","WTE","LMV"],
        "price":19,
        "price_step":1
    },
    {
        "name":"Kids' Bodysuit",
        "code":"10",
        "size":["NB1","NB2"],
        "color":["NTR","BLU","MIT","ORG","PNK","BRN"],
        "price":21,
        "price_step":6
    }
]


infoLabel = [
  {
    "category": "1", #TSHIRT Adult
    "dimensions": "1",
    "sizes": [
      { "size": "S", "weight": "8" },
      { "size": "M", "weight": "8" },
      { "size": "L", "weight": "9" },
      { "size": "XL", "weight": "10" },
      { "size": "2XL", "weight": "10" },
    ],
  },
  {
    "category": "2", #SWEATSHIRT adult
    "dimensions": "2",
    "sizes": [
      { "size": "S", "weight": "14" },
      { "size": "M", "weight": "14" },
      { "size": "L", "weight": "16" },
      { "size": "XL", "weight": "18" },
      { "size": "2XL", "weight": "18" },
    ],
  },
  {
    "category": "3", #SWEATSHIRT KID
    "dimensions": "1",
    "sizes": [
      { "size": "2T", "weight": "4" },
      { "size": "3T", "weight": "4" },
      { "size": "4T", "weight": "4" },
      { "size": "5T", "weight": "5" },
      { "size": "6T", "weight": "5" },
    ],
  },
  {
    "category": "4", #ROMPER KID
    "dimensions": "0.3",
    "sizes": [
      { "size": "03", "weight": "4" },
      { "size": "36", "weight": "4" },
      { "size": "612", "weight": "4" },
      { "size": "1218", "weight": "4" },
      { "size": "1824", "weight": "5" },
    ],
  },
  {
    "category": "5", #BODYSUIT GÂN
    "dimensions": "0.3",
    "sizes": [
      { "size": "3M", "weight": "4" },
      { "size": "6M", "weight": "4" },
      { "size": "9M", "weight": "4" },
      { "size": "12M", "weight": "4" },
      { "size": "18M", "weight": "4" },
      { "size": "24M", "weight": "4" },
    ],
  },
  {
    "category": "6", #BODYSUIT PP
    "dimensions": "0.3",
    "sizes": [
      { "size": "NB", "weight": "4" },
      { "size": "6M", "weight": "4" },
      { "size": "12M", "weight": "4" },
      { "size": "18M", "weight": "4" },
      { "size": "24M", "weight": "4" },
    ],
  },
  {
    "category": "7", #TSHIRT 3001
    "dimensions": "0.5",
    "sizes": [
      { "size": "2T", "weight": "4" },
      { "size": "3T", "weight": "4" },
      { "size": "4T", "weight": "4" },
      { "size": "56T", "weight": "4" },
      { "size": "7T", "weight": "4" },
    ],
  },
  {
    "category": "8", #ROMPER KID SHORT SLEEVE
    "dimensions": "0.3",
    "sizes": [
      { "size": "03", "weight": "4" },
      { "size": "36", "weight": "4" },
      { "size": "612", "weight": "4" },
      { "size": "1218", "weight": "4" },
      { "size": "1824", "weight": "5" },
    ],
  },
  {
    "category": "10", #BODYSUIT GÂN NEW
    "dimensions": "0.3",
    "sizes": [
        { "size": "NB", "weight": "4" },
        { "size": "NB1", "weight": "4" },
        { "size": "NB2", "weight": "5" },
    ],
  },
  {
    "category": "11", #Baby Tee
    "dimensions": "0.5",
    "sizes": [
      { "size": "S", "weight": "4" },
      { "size": "M", "weight": "4" },
      { "size": "L", "weight": "4" },
      { "size": "XL", "weight": "4" },
      { "size": "2XL", "weight": "4" },
    ],
  },
  {
    "category": "12", #SET 12 (Hoodie and Sweatpants)
    "dimensions": "5.5",
    "length": "9",
    "width": "8",
    "sizes": [
      { "size": "S", "weight": "37.7" },
      { "size": "M", "weight": "41" },
      { "size": "L", "weight": "43" },
      { "size": "XL", "weight": "47" },
      { "size": "2XL", "weight": "50" },
    ],
  },
  {
    "category": "13", #HOODIE 13
    "dimensions": "3",
    "length": "9",
    "width": "8",
    "sizes": [
      { "size": "S", "weight": "21" },
      { "size": "M", "weight": "23" },
      { "size": "L", "weight": "25" },
      { "size": "XL", "weight": "27" },
      { "size": "2XL", "weight": "29" },
    ],
  },
  {
    "category": "14", #PANTS 14 (Sweatpants)
    "dimensions": "3",
    "length": "9",
    "width": "8",
    "sizes": [
      { "size": "S", "weight": "17" },
      { "size": "M", "weight": "18" },
      { "size": "L", "weight": "19" },
      { "size": "XL", "weight": "21" },
      { "size": "2XL", "weight": "22" },
    ],
  },
  {
    "category": "15", #SUMMER SET 15
    "dimensions": "0.5",
    "sizes": [{ "size": "S", "weight": "8" }],
  },
  {
    "category": "16", #YOUTH 16
    "dimensions": "0.5",
    "sizes": [
      { "size": "S", "weight": "4" },
      { "size": "M", "weight": "4" },
      { "size": "L", "weight": "4" },
    ],
  },
  {
    "category": "17", #GIFT BOX 17
    "dimensions": "3",
    "sizes": [
      { "size": "S", "weight": "6" },
      { "size": "L", "weight": "9" },
    ],
  },

]

des_detail = '''
<br/><br/>
✅ Product details:<br/>
- Soft and comfortable<br/>
- Retail fit<br/>
- Runs true to size<br/>
- 95% cotton, 5% spandex.<br/>
- Various print positions (Description Figure)<br/><br/>
✅ CARE INSTRUCTIONS<br/>
- Machine wash: warm (max 40C or 105F);<br/>
- Non-chlorine: bleach as needed<br/>
- Tumble dry: low heat<br/>
- Iron, steam or dry: medium heat<br/>
- Do not dry-clean.<br/><br/>
✅ NOTE :<br/>
- Please allow 0.3-0.5" / 1-2 CM differs due to manual measurement.<br/>  
- Please note that due to lighting effect and computer color, the actual color maybe slightly different from picture. Hope for your utmost understanding!<br/><br/>
Thanks for visiting our shop! Enjoy your shopping day ❤️
'''

def get_weight_from_info(category, size):
    """
    Lấy trọng lượng từ infoLabel dựa vào category và size
    
    Args:
        category (str): Category ID của sản phẩm
        size (str): Size của variant
    
    Returns:
        float: Trọng lượng tương ứng
    """
    for item in infoLabel:
        if item['category'] == category:
            for size_info in item['sizes']:
                if size_info['size'] == size:
                    #oz to lb
                    lb = int(size_info['weight'])*0.0625
                    return float(round(lb, 2))
    return None

def generate_handle(title):
    """
    Tạo handle URL thân thiện từ title sản phẩm.
    
    Args:
        title (str): Tiêu đề sản phẩm
        
    Returns:
        str: Handle URL thân thiện với SEO
    """
    import re
    
    # Chuyển đổi sang chữ thường
    handle = title.lower()
    
    # Loại bỏ các ký tự đặc biệt và dấu câu
    handle = re.sub(r'[^\w\s-]', '', handle)
    
    # Thay thế dấu cách và các ký tự không phải chữ cái/số bằng dấu gạch ngang
    handle = re.sub(r'[\s_]+', '-', handle)
    
    # Loại bỏ các từ không cần thiết (stopwords) và từ ngắn
    stopwords = ['and', 'the', 'for', 'with', 'in', 'on', 'at', 'by', 'to', 'a', 'an']
    words = handle.split('-')
    filtered_words = [word for word in words if word not in stopwords and len(word) > 1]
    
    # Nếu sau khi lọc không còn từ nào, giữ lại handle gốc
    if not filtered_words:
        filtered_words = words
    
    # Kết hợp lại các từ đã lọc
    handle = '-'.join(filtered_words)
    
    # Loại bỏ các dấu gạch ngang ở đầu và cuối
    handle = handle.strip('-')
    
    # Giới hạn độ dài (tối đa 60 ký tự cho SEO tốt)
    if len(handle) > 60:
        # Cắt ở dấu gạch ngang gần nhất
        handle = handle[:60].rsplit('-', 1)[0]
    
    # Đảm bảo handle không trống
    if not handle:
        # Nếu không tạo được handle hợp lệ, sử dụng timestamp
        import time
        handle = f"product-{int(time.time())}"
    
    return handle

def jsonRomper(title,description,tags,images,options,variants,iMetafields,product_type="Romper"):
    romperJson = {
    "product": {
        "title": title,
        "body_html": description,
        "vendor": "SoJau",
        "handle": generate_handle(title),
        "status": "active",
        "tags": tags,
        "product_type": product_type,
        "published_scope": "global",
        "options": options,
        "variants": variants,
        "metafields": iMetafields
    },
    "images": images
    }
    return romperJson

def metafields(map_listing,custom_message,video_url,thumbnail_url):
    metafields = []

    if map_listing is not None:
        metafields.append({
            "key": "map_listing",
            "value": map_listing,
            "type": "single_line_text_field",
            "namespace": "custom"
        })
    if custom_message is not None:
        metafields.append({
            "key": "personalization_message",
            "value": custom_message,
            "type": "multi_line_text_field",
            "namespace": "custom"
        })
    if video_url is not None and thumbnail_url is not None:
        metafields.append({
            "key": "product_video",
            "value": video_url,
            "type": "url",
            "namespace": "custom"
        })
        metafields.append({
            "key": "product_video_thumbnail",
            "value": thumbnail_url,
            "type": "url",
            "namespace": "custom"
        })
    return metafields

def generate_variants(kinds,percent=0.65):
    """
    Tạo options và variants dựa trên danh sách kinds (mã sản phẩm).
    
    Args:
        kinds (list): Danh sách mã sản phẩm (ví dụ: ["4", "3"])
        min_price (float): Giá tối thiểu cho size nhỏ nhất
        price_step (float): Bước nhảy giá cho mỗi size tiếp theo
        
    Returns:
        dict: Dictionary chứa options và variants
    """
    # Tạo options tổng hợp từ tất cả các sản phẩm
    all_sizes = []
    all_colors = []
    
    for kind in kinds:
        for p in products:
            if p["code"] == kind:
                # Thêm sizes
                for s_code in p["size"]:
                    size_value = f"{p['name']} {size.get(s_code, s_code)}"
                    if size_value not in all_sizes:
                        all_sizes.append(size_value)
                
                # Thêm colors
                for c_code in p["color"]:
                    color_value = color.get(c_code, c_code)
                    if color_value not in all_colors:
                        all_colors.append(color_value)
    
    options = [
        {
            "name": "SIZE",
            "values": all_sizes
        },
        {
            "name": "COLOR", 
            "values": all_colors
        }
    ]
    
    # Tạo variants cho tất cả các kind
    variants = []
    
    for kind in kinds:
        # Tìm product tương ứng với kind
        current_product = next((p for p in products if p["code"] == kind), None)
        if not current_product:
            continue
        
        min_price = current_product["price"]
        price_step = current_product["price_step"]
        for i, s_code in enumerate(current_product["size"]):
            # Tính giá dựa trên size
            current_price = min_price + (i * price_step)
            # Tính giá so sánh (compare_at_price)
            compare_price = round(current_price * 1.5, 2)
            
            for c_code in current_product["color"]:
                # Lấy tên đầy đủ của size và color
                size_name = size.get(s_code, s_code)
                color_name = color.get(c_code, c_code)
                
                # Tạo SKU theo định dạng: MÃ_MÀU + MÃ_SẢN_PHẨM - MÃ_SIZE
                sku = f"{c_code}{current_product['code']} - {s_code}"
                
                # Tạo variant
                price_sale = round(compare_price*percent,2)
                variant = {
                    "option1": f"{current_product['name']} {size_name}",  # SIZE
                    "option2": color_name,                               # COLOR
                    "price": price_sale,
                    "compare_at_price": compare_price,
                    "sku": sku,
                    "weight": get_weight_from_info(current_product['code'], s_code),
                    "inventory_management": "shopify",
                    "inventory_policy": "deny",
                    "fulfillment_service": "manual",
                    "inventory_quantity": 100
                }
                
                variants.append(variant)
    
    return {
        "options": options,
        "variants": variants
    }

# kq = generate_variants(["4","3","2"])
# print(json.dumps(kq, indent=4))

#region API
def jsonListing(listing_id):
    response = requests.get(f"https://qr.stability.ltd/get-tags?listingId={listing_id}")
    jsonData = response.json()
    return jsonData

def jsonShop(shopName,limit=36,offset=0):
    response = requests.get("https://qr.stability.ltd/api-shop?shop_name="+shopName+"&limit="+str(limit)+"&offset="+str(offset))
    # print(response.text)
    if response.status_code == 200:
        jsonData = response.json()
        return jsonData
    else:
        return None

def extract_product_info(etsy_data):

    # Khởi tạo kết quả
    result = {
        "title": "",
        "images": [],
        "video_url": None,
        "video_thumbnail": None,
        "personalization_instructions": None
    }
    
    # Lấy tiêu đề và decode HTML entities nếu có
    if "title" in etsy_data:
        import html
        result["title"] = html.unescape(etsy_data["title"])
    
    # Lấy danh sách ảnh
    if "images" in etsy_data and isinstance(etsy_data["images"], list):
        for image in etsy_data["images"]:
            if "url_fullxfull" in image:
                result["images"].append(image["url_fullxfull"])
    
    # Kiểm tra và lấy thông tin video (nếu có)
    # Etsy thường lưu thông tin video trong trường file_data hoặc dưới dạng metadata
    if "videos" in etsy_data and etsy_data["videos"]:
        result["video_url"] = etsy_data["videos"][0]["video_url"]
        result["video_thumbnail"] = etsy_data["videos"][0]["thumbnail_url"]

    if "personalization_instructions" in etsy_data:
        result["personalization_instructions"] = etsy_data["personalization_instructions"]
    
    return result

def getKindProduct(products):
    kinds = []
    for product in products:
        try:
            kind=product["sku"].split("-")[0].strip()[3:]
            if kind not in kinds and kind != "":
                kinds.append(kind)
        except:
            pass
    return kinds

def Main_render(listing_id):
    mapKinds =[
        {   "code":"1",
            "mapKind":["4"],
            "product_type":"Romper Kid Long Sleeve"
        },
        {
            "code":"2",
            "mapKind":["4","3","2"],
            "product_type":"Matching Family Long Sleeve"
        },
        {
            "code":"3",
            "mapKind":["8"],
            "product_type":"Romper Kid Short Sleeve"
        },
        {   
            "code":"4",
            "mapKind":["8","7","1"],
            "product_type":"Matching Family Short Sleeve"
        },
        {
            "code":"5",
            "mapKind":["10"],
            "product_type":"Set Bodysuit Kid"
        }
    ]

    jsonData = jsonListing(listing_id)
    kinds = getKindProduct(jsonData["inventory"]["products"])     # kinds = ["4","3"]
    if set(kinds) == set(['8', '4', '3']):
        kinds = ["8"]
    if set(kinds) == set(['4', '3']):
        kinds = ["4"]
    if set(kinds) == set(['4', '2']) or set(kinds) == set(['4', '3', '2', '19']):
        kinds = ["4","3","2"]
    print("kinds",kinds)

    product_type = None
    for mapKind in mapKinds:
        if set(kinds) == set(mapKind["mapKind"]):
            imapKinds = mapKind["mapKind"]
            product_type = mapKind["product_type"]
            break
    if product_type is None:
        return None
    print("listing_id",listing_id,"imapKinds",imapKinds,"product_type",product_type)

    product_info = extract_product_info(jsonData)
    images = product_info["images"]
    title = product_info["title"]
    video_url = product_info["video_url"]
    thumbnail_url = product_info["video_thumbnail"]
    personalization_instructions = product_info["personalization_instructions"]

    newJson = render_title(title,images[0],personalization_instructions, product_type)
    new_title = newJson["title"]
    description = newJson["description"] + des_detail
    tags = newJson["tags"]

    iMetafields = metafields(listing_id,personalization_instructions,video_url,thumbnail_url)

    if imapKinds == ["4"]:
        imapKinds = ["4","8"]
    elif imapKinds == ["8"]:
        imapKinds = ["8","4"]
    res = generate_variants(imapKinds)
    options = res["options"]
    variants = res["variants"]

    iProductd = jsonRomper(new_title,description,tags,images,options,variants,iMetafields,product_type)
    # print(json.dumps(iProductd, indent=4))
    return iProductd

# Main_render("1657071392")

# result = render_title("Our First Mother's Day Together Romper Baby Bodysuit","https://luthcreative.com/cdn/shop/files/Make_this_first_Mother_s_Day_truly_memorable_with_the_Our_First_Mother_s_Day_Together.jpg","Name mom and baby", "Romper Kid")
# print(json.dumps(result, indent=4))

# jsonShop("ViviMahStore")
# html = requests.get("https://qr.stability.ltd/api-shop?shop_name=ViviMahStore&&limit=36&&offset=0")
# print(html.text)


def download_image(listing_id,name):
    info = jsonListing(listing_id)
    print(json.dumps(info, indent=4))

    for i,image in enumerate(info["images"]):
        thread = threading.Thread(target=download_image_thread, args=(image,name,i))
        thread.start()

    thread = threading.Thread(target=download_video_thread, args=(info["videos"][0]["video_url"],name))
    thread.start()

def download_image_thread(image,name,i):
    url = image["url_fullxfull"]
    print(url)
    #download image
    response = requests.get(url)
    with open(f"{name}_{i}.jpg", "wb") as f:
        f.write(response.content)

def download_video_thread(url,name):
    response = requests.get(url)
    with open(f"{name}_video.mp4", "wb") as f:
        f.write(response.content)



# download_image("4299995065")