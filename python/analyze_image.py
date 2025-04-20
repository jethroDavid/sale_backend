import base64
import sys
import json
import os
from pathlib import Path
import openai

# Load API key from config file
config_path = Path(__file__).parent / "config.json"
try:
    with open(config_path, "r") as config_file:
        config = json.load(config_file)
        api_key = config.get("openai_api_key")
        if not api_key:
            print("Error: API key not found in config file")
            sys.exit(1)
except FileNotFoundError:
    print(f"Error: Config file not found at {config_path}")
    print("Please create a config.json file with your OpenAI API key")
    sys.exit(1)
except json.JSONDecodeError:
    print(f"Error: Config file at {config_path} is not valid JSON")
    sys.exit(1)

# Initialize OpenAI client
client = openai.OpenAI(api_key=api_key)

def encode_image(image_path):
    """Reads and encodes an image in base64 format"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def clean_json_response(response_text):
    """Cleans GPT response to extract pure JSON"""
    response_text = response_text.strip()
    
    # Remove surrounding triple backticks if present
    if response_text.startswith("```json"):
        response_text = response_text[7:]  # Remove ```json
    if response_text.endswith("```"):
        response_text = response_text[:-3]  # Remove ```
    
    return response_text.strip()

def analyze_image(image_path):
    """Sends image to GPT-4 Turbo Vision API and returns structured JSON"""
    try:
        image_base64 = encode_image(image_path)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI that extracts structured eCommerce insights from images."},
                {"role": "user", "content": [
                    {"type": "text", "text": """
                        Analyze this image and return JSON with the following:
                        - "isEcommerce" (true/false): Is this an eCommerce-related image?
                        - "isProductPage" (true/false): Does the image show a product page?
                        - "isOnSale" (true/false): Does the image indicate that this specific product has a reduced price? Look for:
                        * Crossed-out original price with a lower current price
                        * Explicit percentage or amount off this specific product
                        * Product-specific sale tags/badges (like "Sale", "Discount", "Limited offer")
                        * Price comparison showing savings on this exact product
                        - "confidence" (0-1): How confident are you that the product is on sale?
                        - "productName" (string): If visible, what is the product name?
                        - "price" (string): If available, what is the current price?
                        - "originalPrice" (string): If available, what was the original price before discount?
                        - "currency" (string): If a price is detected, what is the currency?
                        - "discountPercentage" (float): If applicable, what is the discount percentage?
                        - "otherInsights" (string): Any additional useful insights?
                        - "discountDetails" (string): If applicable, what are the specific terms of this product's discount?
                        
                        IMPORTANT: Do NOT mark a product as on sale if you only see:
                        - Generic site-wide banners (e.g., "Summer sale")
                        - Promotional codes that apply to the entire cart
                        - Free shipping offers
                        - Loyalty program benefits
                        - Future/upcoming sales
                        - "New arrival" or similar non-discount indicators
                        
                        A product is on sale ONLY if there's clear evidence of a price reduction for THIS SPECIFIC product visible in the image.
                        
                        Respond **only** with valid JSON, no explanations, and no code formatting (no backticks).
                    """},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]}
            ],
            max_tokens=400
        )

        # Print raw response for debugging
        raw_response = response.choices[0].message.content
        print("Raw Response:", raw_response)  # Debugging step

        # Clean and parse the JSON response
        cleaned_response = clean_json_response(raw_response)
        return json.loads(cleaned_response)

    except json.JSONDecodeError:
        return {"error": "Invalid JSON response after cleaning"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Please provide an image path as an argument.")
        sys.exit(1)
    
    image_path = sys.argv[1]
    if not Path(image_path).is_file():
        print("Invalid image path.")
        sys.exit(1)
    
    result = analyze_image(image_path)
    print(json.dumps(result, indent=2))  # Pretty-print JSON
