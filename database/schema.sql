CREATE DATABASE IF NOT EXISTS sale_app;
USE sale_app;

-- Table for URLs to monitor
CREATE TABLE IF NOT EXISTS monitored_urls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(2048) NOT NULL,
  frequency_hours INT NOT NULL, -- 6, 12, or 24 hours
  last_checked DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,
  status ENUM('active', 'paused', 'error') DEFAULT 'active',
  failed_attempts INT DEFAULT 0, -- Count of consecutive failed screenshot attempts
  UNIQUE KEY (url(768))
);

-- Table for user-URL associations
CREATE TABLE IF NOT EXISTS user_urls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  url_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (url_id) REFERENCES monitored_urls(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_url (user_id, url_id),
  INDEX idx_user_id (user_id),
  INDEX idx_url_id (url_id)
);

-- Table for screenshot records
CREATE TABLE IF NOT EXISTS screenshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url_id INT NOT NULL,
  screenshot_path VARCHAR(1024) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  analyzed BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (url_id) REFERENCES monitored_urls(id)
);

-- Table for analysis results
CREATE TABLE IF NOT EXISTS analysis_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  screenshot_id INT NOT NULL,
  is_ecommerce BOOLEAN DEFAULT FALSE,
  is_product_page BOOLEAN DEFAULT FALSE,
  is_on_sale BOOLEAN DEFAULT FALSE,
  confidence FLOAT,
  product_name VARCHAR(255),
  price VARCHAR(50),
  currency VARCHAR(10),
  discount_percentage FLOAT,
  other_insights TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  discount_details TEXT,
  FOREIGN KEY (screenshot_id) REFERENCES screenshots(id)
);

-- Table for URLs to availability
CREATE TABLE IF NOT EXISTS availability_urls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(2048) NOT NULL,
  frequency_hours INT NOT NULL, -- 6, 12, or 24 hours
  last_checked DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,
  status ENUM('active', 'paused', 'error') DEFAULT 'active',
  failed_attempts INT DEFAULT 0, -- Count of consecutive failed screenshot attempts
  UNIQUE KEY (url(768))
);

-- Table for screenshot records
CREATE TABLE IF NOT EXISTS availability_screenshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url_id INT NOT NULL,
  screenshot_path VARCHAR(1024) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  analyzed BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (url_id) REFERENCES availability_urls(id)
);

-- Table for user-URL associations
CREATE TABLE IF NOT EXISTS availability_user_urls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  url_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (url_id) REFERENCES availability_urls(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_url (user_id, url_id),
  INDEX idx_user_id (user_id),
  INDEX idx_url_id (url_id)
);

-- Table for availability tracking results
CREATE TABLE IF NOT EXISTS availability_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  screenshot_id INT NOT NULL,
  is_ecommerce BOOLEAN DEFAULT FALSE,
  is_product_page BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT FALSE,
  confidence FLOAT,
  product_name VARCHAR(255),
  stock_status VARCHAR(100),
  availability_details TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (screenshot_id) REFERENCES availability_screenshots(id)
);
