CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_id INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  deep_link VARCHAR(255) NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notification_event (recipient_id,event_type,entity_type,entity_id),
  KEY idx_notifications_recipient (recipient_id,read_at,created_at),
  CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_id) REFERENCES users(id)
);
CREATE TABLE notification_preferences (
  user_id INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id,event_type),
  CONSTRAINT fk_notification_preference_user FOREIGN KEY (user_id) REFERENCES users(id)
);
