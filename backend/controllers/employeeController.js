const {
  validateCreateEmployeeInput,
  validateUpdateEmployeeInput,
} = require('../validators/employeeValidator');

const {
  findEmployeeByUserId,
  findEmployeeById,
  findAllEmployees,
  findEmployeesByManagerId,
  checkDepartmentExists,
  checkEmailOrCodeExists,
  createEmployeeWithTransaction,
  updateEmployee: updateEmployeeService,
  deleteEmployeeWithTransaction,
} = require('../services/employeeService');

/**
 * GET /api/employees/me
 * Authenticated user's employee profile
 */
const getMe = async (req, res, next) => {
  try {
    const employee = await findEmployeeByUserId(req.user.userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found for the authenticated user.',
      });
    }

    return res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/employees
 * Admin: View all employees
 * Manager: View team employees only
 * Employee: Prohibited (403)
 */
const getEmployees = async (req, res, next) => {
  try {
    const { role, userId } = req.user;

    if (role === 'admin') {
      const employees = await findAllEmployees();
      return res.status(200).json({
        success: true,
        count: employees.length,
        employees,
      });
    }

    if (role === 'manager') {
      const managerEmp = await findEmployeeByUserId(userId);
      if (!managerEmp) {
        return res.status(404).json({
          success: false,
          message: 'Manager employee profile not found.',
        });
      }

      const teamEmployees = await findEmployeesByManagerId(managerEmp.id);
      return res.status(200).json({
        success: true,
        count: teamEmployees.length,
        employees: teamEmployees,
      });
    }

    // Employee role is not permitted to list directory
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Employees are not authorized to view the employee directory.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/employees/:id
 * Admin: Can view any employee
 * Manager: Can view team members or self only
 * Employee: Can view self only
 */
const getEmployeeById = async (req, res, next) => {
  try {
    const targetEmployeeId = parseInt(req.params.id, 10);
    if (isNaN(targetEmployeeId) || targetEmployeeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID parameter.',
      });
    }

    const targetEmployee = await findEmployeeById(targetEmployeeId);
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    const { role, userId } = req.user;

    // Admin can view any employee
    if (role === 'admin') {
      return res.status(200).json({
        success: true,
        employee: targetEmployee,
      });
    }

    const reqEmployee = await findEmployeeByUserId(userId);
    if (!reqEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Requester employee profile not found.',
      });
    }

    // Manager can view self or team members
    if (role === 'manager') {
      const isSelf = targetEmployee.id === reqEmployee.id;
      const isTeamMember = targetEmployee.manager_id === reqEmployee.id;

      if (!isSelf && !isTeamMember) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Managers can only view members of their team.',
        });
      }

      return res.status(200).json({
        success: true,
        employee: targetEmployee,
      });
    }

    // Employee can view self only
    if (role === 'employee') {
      if (targetEmployee.id !== reqEmployee.id) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Employees can only view their own employee profile.',
        });
      }

      return res.status(200).json({
        success: true,
        employee: targetEmployee,
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/employees
 * Admin only
 */
const createEmployee = async (req, res, next) => {
  try {
    const validation = validateCreateEmployeeInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' '),
      });
    }

    const {
      email,
      password,
      role,
      firstName,
      lastName,
      employeeCode,
      departmentId,
      managerId,
      joiningDate,
    } = req.body;

    // 1. Verify department exists
    const deptExists = await checkDepartmentExists(departmentId);
    if (!deptExists) {
      return res.status(400).json({
        success: false,
        message: `Department with ID ${departmentId} does not exist.`,
      });
    }

    // 2. Verify manager exists if managerId provided
    if (managerId) {
      const managerExists = await findEmployeeById(managerId);
      if (!managerExists) {
        return res.status(400).json({
          success: false,
          message: `Manager employee with ID ${managerId} does not exist.`,
        });
      }
    }

    // 3. Verify uniqueness of email and employeeCode
    const duplicateCheck = await checkEmailOrCodeExists(email, employeeCode);
    if (duplicateCheck.exists) {
      return res.status(409).json({
        success: false,
        message:
          duplicateCheck.field === 'email'
            ? 'Email address is already registered.'
            : 'Employee code is already in use.',
      });
    }

    // 4. Create user and employee within database transaction
    const newEmployee = await createEmployeeWithTransaction({
      email,
      password,
      role: role || 'employee',
      firstName,
      lastName,
      employeeCode,
      departmentId,
      managerId,
      joiningDate,
      actingUserId: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee: newEmployee,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/employees/:id
 * Admin only
 */
const updateEmployeeController = async (req, res, next) => {
  try {
    const targetEmployeeId = parseInt(req.params.id, 10);
    if (isNaN(targetEmployeeId) || targetEmployeeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID parameter.',
      });
    }

    const targetEmployee = await findEmployeeById(targetEmployeeId);
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    const validation = validateUpdateEmployeeInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' '),
      });
    }

    const { departmentId, managerId, email } = req.body;

    if (departmentId) {
      const deptExists = await checkDepartmentExists(departmentId);
      if (!deptExists) {
        return res.status(400).json({
          success: false,
          message: `Department with ID ${departmentId} does not exist.`,
        });
      }
    }

    if (managerId) {
      if (parseInt(managerId, 10) === targetEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'An employee cannot be assigned as their own manager.',
        });
      }

      const managerExists = await findEmployeeById(managerId);
      if (!managerExists) {
        return res.status(400).json({
          success: false,
          message: `Manager employee with ID ${managerId} does not exist.`,
        });
      }
    }

    if (email) {
      const duplicateCheck = await checkEmailOrCodeExists(email, null, targetEmployeeId);
      if (duplicateCheck.exists) {
        return res.status(409).json({
          success: false,
          message: 'Email address is already in use by another account.',
        });
      }
    }

    const updatedEmp = await updateEmployeeService(targetEmployeeId, req.body, req.user.userId);

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      employee: updatedEmp,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/employees/:id
 * Admin only
 */
const deleteEmployeeController = async (req, res, next) => {
  try {
    const targetEmployeeId = parseInt(req.params.id, 10);
    if (isNaN(targetEmployeeId) || targetEmployeeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID parameter.',
      });
    }

    const targetEmployee = await findEmployeeById(targetEmployeeId);
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    await deleteEmployeeWithTransaction(targetEmployeeId, req.user.userId);

    return res.status(200).json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee: updateEmployeeController,
  deleteEmployee: deleteEmployeeController,
};
