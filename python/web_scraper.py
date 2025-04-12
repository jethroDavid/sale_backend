import requests
from bs4 import BeautifulSoup
import argparse

def scrape_website(url):
    try:
        # Send HTTP request
        response = requests.get(url)
        response.raise_for_status()  # Raise exception for HTTP errors
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove unnecessary elements
        for element in soup(['style', 'script', 'link', 'meta', 'noscript', 'svg']):
            element.decompose()
            
        # Get text content
        text = soup.get_text(separator='\n', strip=True)
        
        return text
        
    except Exception as e:
        return f"Error: {str(e)}"

# Example usage
if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Web scraper tool')
    parser.add_argument('url', nargs='?', default="https://example.com",
                      help='URL to scrape')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Call the scrape function with the provided URL
    content = scrape_website(args.url)
    
    # Print content
    print("WEBSITE CONTENT:")
    print(content)