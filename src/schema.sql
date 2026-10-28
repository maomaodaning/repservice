-- ============================================================
-- Схема БД: АИС управления заявками на ремонт цифровой техники
-- PostgreSQL
-- ============================================================

-- Удаляем таблицы, если они уже есть для повторного запуска)
DROP TABLE IF EXISTS order_item CASCADE;
DROP TABLE IF EXISTS purchase_order CASCADE;
DROP TABLE IF EXISTS notification CASCADE;
DROP TABLE IF EXISTS request_part CASCADE;
DROP TABLE IF EXISTS payment CASCADE;
DROP TABLE IF EXISTS work_report CASCADE;
DROP TABLE IF EXISTS diagnostic CASCADE;
DROP TABLE IF EXISTS request CASCADE;
DROP TABLE IF EXISTS device CASCADE;
DROP TABLE IF EXISTS part CASCADE;
DROP TABLE IF EXISTS service CASCADE;
DROP TABLE IF EXISTS supplier CASCADE;
DROP TABLE IF EXISTS master CASCADE;
DROP TABLE IF EXISTS client CASCADE;
DROP TABLE IF EXISTS admin CASCADE;
DROP TABLE IF EXISTS status CASCADE;

-- ============================================================
-- СПРАВОЧНИКИ
-- ============================================================

-- Статусы заявок
CREATE TABLE status (
    status_id   SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Поставщики
CREATE TABLE supplier (
    supplier_id SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(50),
    email       VARCHAR(255),
    address     TEXT
);

-- Услуги (прайс-лист)
CREATE TABLE service (
    service_id  SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    duration    INTEGER CHECK (duration >= 0)  -- в минутах
);

-- ============================================================
-- ПОЛЬЗОВАТЕЛИ
-- ============================================================

-- Клиенты
CREATE TABLE client (
    client_id       SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50) NOT NULL,
    email           VARCHAR(255),
    address         TEXT,
    login           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    registration_date TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Мастера
CREATE TABLE master (
    master_id       SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50) NOT NULL,
    specialization  VARCHAR(255),
    rating          NUMERIC(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    login           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL
);

-- Администраторы
CREATE TABLE admin (
    admin_id        SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    login           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'admin'
);

-- ============================================================
-- ОБОРУДОВАНИЕ И ЗАЯВКИ
-- ============================================================

-- Устройства
CREATE TABLE device (
    device_id       SERIAL PRIMARY KEY,
    client_id       INTEGER NOT NULL REFERENCES client(client_id) ON DELETE RESTRICT,
    type            VARCHAR(100) NOT NULL,       -- ноутбук, телефон...
    brand           VARCHAR(100),
    model           VARCHAR(100),
    serial_number   VARCHAR(100),
    condition       TEXT                          -- состояние при приёме
);

-- Заявки
CREATE TABLE request (
    request_id          SERIAL PRIMARY KEY,
    client_id           INTEGER NOT NULL REFERENCES client(client_id) ON DELETE RESTRICT,
    device_id           INTEGER NOT NULL REFERENCES device(device_id) ON DELETE RESTRICT,
    master_id           INTEGER REFERENCES master(master_id) ON DELETE RESTRICT,  -- может быть NULL, пока не назначен
    status_id           INTEGER NOT NULL REFERENCES status(status_id) ON DELETE RESTRICT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMP,
    problem_description TEXT NOT NULL,
    total_cost          NUMERIC(10, 2) CHECK (total_cost >= 0)
);

-- Диагностика
CREATE TABLE diagnostic (
    diagnostic_id       SERIAL PRIMARY KEY,
    request_id          INTEGER NOT NULL REFERENCES request(request_id) ON DELETE CASCADE,
    diagnostic_date     TIMESTAMP NOT NULL DEFAULT NOW(),
    result              TEXT,
    recommended_actions TEXT,
    estimated_cost      NUMERIC(10, 2) CHECK (estimated_cost >= 0)
);

-- Отчёт о работах
CREATE TABLE work_report (
    report_id           SERIAL PRIMARY KEY,
    request_id          INTEGER NOT NULL REFERENCES request(request_id) ON DELETE CASCADE,
    master_id           INTEGER NOT NULL REFERENCES master(master_id) ON DELETE RESTRICT,
    report_date         TIMESTAMP NOT NULL DEFAULT NOW(),
    work_description    TEXT NOT NULL,
    labor_cost          NUMERIC(10, 2) NOT NULL CHECK (labor_cost >= 0)
);

-- Оплаты
CREATE TABLE payment (
    payment_id          SERIAL PRIMARY KEY,
    request_id          INTEGER NOT NULL REFERENCES request(request_id) ON DELETE CASCADE,
    payment_date        TIMESTAMP NOT NULL DEFAULT NOW(),
    amount              NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    method              VARCHAR(50) NOT NULL,     -- наличные, карта
    status              VARCHAR(50) NOT NULL DEFAULT 'completed'
);

-- ============================================================
-- СКЛАД
-- ============================================================

-- Запчасти
CREATE TABLE part (
    part_id         SERIAL PRIMARY KEY,
    supplier_id     INTEGER REFERENCES supplier(supplier_id) ON DELETE RESTRICT,
    name            VARCHAR(255) NOT NULL,
    article         VARCHAR(100),
    quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    min_quantity    INTEGER NOT NULL DEFAULT 0 CHECK (min_quantity >= 0)
);

-- Использованные запчасти в заявке (M:N)
CREATE TABLE request_part (
    request_id      INTEGER NOT NULL REFERENCES request(request_id) ON DELETE CASCADE,
    part_id         INTEGER NOT NULL REFERENCES part(part_id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    price_at_moment NUMERIC(10, 2) NOT NULL CHECK (price_at_moment >= 0),
    PRIMARY KEY (request_id, part_id)
);

-- ============================================================
-- ЗАКАЗЫ ПОСТАВЩИКАМ
-- ============================================================

-- Заказы
CREATE TABLE purchase_order (
    order_id        SERIAL PRIMARY KEY,
    supplier_id     INTEGER NOT NULL REFERENCES supplier(supplier_id) ON DELETE RESTRICT,
    status          VARCHAR(50) NOT NULL DEFAULT 'ordered',  -- ordered / received
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    received_at     TIMESTAMP
);

-- Позиции заказа
CREATE TABLE order_item (
    item_id         SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES purchase_order(order_id) ON DELETE CASCADE,
    part_id         INTEGER NOT NULL REFERENCES part(part_id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL CHECK (quantity > 0)
);

-- ============================================================
-- УВЕДОМЛЕНИЯ
-- ============================================================

CREATE TABLE notification (
    notification_id SERIAL PRIMARY KEY,
    user_role       VARCHAR(20) NOT NULL CHECK (user_role IN ('client', 'master', 'admin')),
    user_id         INTEGER NOT NULL,
    type            VARCHAR(50) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ИНДЕКСЫ (для ускорения частых запросов)
-- ============================================================

CREATE INDEX idx_request_client    ON request(client_id);
CREATE INDEX idx_request_master    ON request(master_id);
CREATE INDEX idx_request_status    ON request(status_id);
CREATE INDEX idx_request_created   ON request(created_at);
CREATE INDEX idx_device_client     ON device(client_id);
CREATE INDEX idx_notification_user ON notification(user_role, user_id);
CREATE INDEX idx_notification_read ON notification(is_read);
CREATE INDEX idx_payment_request   ON payment(request_id);