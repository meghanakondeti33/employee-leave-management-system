-- =============================================================================
-- Employee Leave & Workforce Management System
-- Database Schema Definition (Phase 2)
-- Database Engine: MySQL 8.0+ / InnoDB
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `employee_leave_management`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `employee_leave_management`;

-- -----------------------------------------------------------------------------
-- 1. Table: users
-- Stores authentication credentials and role assignments.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('employee', 'manager', 'admin') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Table: departments
-- Stores organizational structure and department names.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `departments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_departments_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Table: employees
-- Stores detailed employee profile data.
-- Foreign keys link each employee to a user account, department, and manager.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employees` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `department_id` INT NOT NULL,
  `manager_id` INT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `employee_code` VARCHAR(50) NOT NULL UNIQUE,
  `joining_date` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_employees_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  CONSTRAINT `fk_employees_department` 
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  CONSTRAINT `fk_employees_manager` 
    FOREIGN KEY (`manager_id`) REFERENCES `employees` (`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE,
    
  INDEX `idx_employees_code` (`employee_code`),
  INDEX `idx_employees_department_id` (`department_id`),
  INDEX `idx_employees_manager_id` (`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Table: leave_policies
-- Defines rules and annual quotas for different leave types (Casual, Sick, Paid, etc.).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leave_policies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `annual_limit` INT NOT NULL CHECK (`annual_limit` >= 0),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_leave_policies_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Table: leave_balances
-- Tracks yearly allocated, used, and remaining leave quotas per employee.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leave_balances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `leave_policy_id` INT NOT NULL,
  `year` INT NOT NULL,
  `allocated_days` DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (`allocated_days` >= 0),
  `used_days` DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (`used_days` >= 0),
  `remaining_days` DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (`remaining_days` >= 0),
  
  CONSTRAINT `uq_employee_policy_year` 
    UNIQUE (`employee_id`, `leave_policy_id`, `year`),
    
  CONSTRAINT `fk_leave_balances_employee` 
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT `fk_leave_balances_policy` 
    FOREIGN KEY (`leave_policy_id`) REFERENCES `leave_policies` (`id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  INDEX `idx_leave_balances_emp_policy_year` (`employee_id`, `leave_policy_id`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Table: leave_requests
-- Tracks leave applications, statuses, approvals/rejections, and date ranges.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `leave_policy_id` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `days` DECIMAL(5,2) NOT NULL CHECK (`days` > 0),
  `reason` TEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `rejection_reason` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_leave_requests_employee` 
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT `fk_leave_requests_policy` 
    FOREIGN KEY (`leave_policy_id`) REFERENCES `leave_policies` (`id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  CONSTRAINT `fk_leave_requests_approved_by` 
    FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE,
    
  INDEX `idx_leave_requests_employee_id` (`employee_id`),
  INDEX `idx_leave_requests_status` (`status`),
  INDEX `idx_leave_requests_start_date` (`start_date`),
  INDEX `idx_leave_requests_date_range` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Table: audit_logs
-- Tracks administrative actions, approvals, and system activities for audit trailing.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` INT NULL,
  `description` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_audit_logs_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  INDEX `idx_audit_logs_user_id` (`user_id`),
  INDEX `idx_audit_logs_created_at` (`created_at`),
  INDEX `idx_audit_logs_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
