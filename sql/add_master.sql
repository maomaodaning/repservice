-- Создаём мастера
INSERT INTO master (full_name, phone, specialization, login, password_hash) 
VALUES (
    'Иванов Иван', 
    '+7 (999) 111-22-33', 
    'Ремонт ноутбуков', 
    'master1', 
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
);

-- Назначаем его на первую заявку и ставим статус "В работе"
UPDATE request 
SET master_id = (SELECT master_id FROM master WHERE login = 'master1'),
    status_id = (SELECT status_id FROM status WHERE name = 'В работе')
WHERE request_id = 1;