-- Users table schema

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  google_id VARCHAR(255) DEFAULT NULL,
  auth_type ENUM('email', 'google', 'both') NOT NULL DEFAULT 'email',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_google_id (google_id)
);
