CREATE TABLE IF NOT EXISTS sales_line_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bill_no VARCHAR(64) NOT NULL,
  outlet_name VARCHAR(120) NOT NULL,
  brand VARCHAR(120) NOT NULL,
  order_datetime DATETIME NOT NULL,
  item_group VARCHAR(120) NOT NULL,
  order_type VARCHAR(80) NOT NULL,
  item VARCHAR(180) NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  settlement VARCHAR(120) NOT NULL,
  line_revenue DECIMAL(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sales_order_datetime (order_datetime),
  INDEX idx_sales_bill_no (bill_no),
  INDEX idx_sales_outlet_datetime (outlet_name, order_datetime),
  INDEX idx_sales_brand_datetime (brand, order_datetime),
  INDEX idx_sales_group_datetime (item_group, order_datetime),
  INDEX idx_sales_order_type_datetime (order_type, order_datetime),
  INDEX idx_sales_settlement_datetime (settlement, order_datetime),
  INDEX idx_sales_item_group (item, item_group),
  INDEX idx_sales_item_datetime (item, order_datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'analyst') NOT NULL DEFAULT 'analyst',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
