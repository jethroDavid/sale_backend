import requests
from bs4 import BeautifulSoup
import argparse
import time

def scrape_website(url, wait_time=0, use_selenium=False):
    try:
        if use_selenium:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            
            # Set up headless Chrome browser
            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--disable-gpu")
            
            # Initialize browser
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
            
            # Get the page
            driver.get(url)
            
            # Wait for the specified time to let JavaScript execute
            if wait_time > 0:
                print(f"Waiting {wait_time} seconds for page to load...")
                time.sleep(wait_time)
            
            # Get the page source after JavaScript execution
            html = driver.page_source
            driver.quit()
            
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
        else:
            # Send HTTP request
            response = requests.get(url)
            response.raise_for_status()  # Raise exception for HTTP errors
            
            # Wait if specified
            if wait_time > 0:
                print(f"Waiting {wait_time} seconds for page to load...")
                time.sleep(wait_time)
                
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
    parser.add_argument('--wait', type=int, default=0,
                      help='Wait time in seconds for the page to load')
    parser.add_argument('--selenium', action='store_true',
                      help='Use Selenium for JavaScript-rendered pages')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Call the scrape function with the provided URL
    content = scrape_website(args.url, wait_time=args.wait, use_selenium=args.selenium)
    
    # Print content
    print("WEBSITE CONTENT:")
    print(content)