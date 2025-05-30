
const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const path = require("path");
const winston = require('winston');
const XLSX = require('xlsx');
const fs = require('fs');
const chokidar = require('chokidar');
const { processExcelData, mainDataSync } = require('./dataSync');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const session = require('express-session');


const redis = require('redis');
const { promisify } = require('util');

dotenv.config();


const PORT = process.env.PORT || 8000;
app.use(cors());


app.use('/images', express.static(path.join(__dirname, '..', 'Client', 'Images')));
app.use(express.static(path.join(__dirname, '..', 'Client/home.html')));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbService = require('./dbService.js'); 
 const { Console } = require('console');
const moment = require('moment/moment.js');
const db = dbService.getDbServiceInstance();

//test









// session key 

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));


const logger = winston.createLogger({
    level: 'debug',
     format: 
     winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
       new winston.transports.File({ filename: 'error.log', level: 'error' }),
       new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
               winston.format.simple()
            )
        })
    ]
});



app.use((err, req, res, next) => {
    logger.error('Unhandled error:', { 
        error: err.message, 
        stack: err.stack,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body
    });
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
});





// Send email route
// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',  // Replace with your email service provider
    auth: {
        user: 'boompowfire@gmail.com',  // Replace with your Gmail address
        pass: 'BoomPow123'    // Replace with your email password
    }
});

// Send email route
app.post('/send-email', (req, res) => {
    // Log the incoming request body
    console.log('Received request to send email:', req.body);
    
    // Extract email details from the request body
    const { to, subject, text, html } = req.body;

    // Validate required fields
    if (!to || !subject || !text) {
        console.log('Error: Missing required email fields (to, subject, text).');
        return res.status(400).send('Missing required fields: to, subject, text');
    }

    console.log(`Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Email Body: ${text}`);

    // Set up email options
    const mailOptions = {
        from: '"Your Name" <boompowfire@gmail.com>',  // Replace with your name and email
        to: to,
        subject: subject,
        text: text,
        html: html || text  // If no HTML body, fallback to plain text
    };

    // Log email options before sending
    console.log('Mail Options:', mailOptions);

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error occurred while sending email:', error);
            return res.status(500).send('Error sending email');
        }

        // Log success response
        console.log('Email sent successfully:', info.response);
        res.status(200).send('Email sent: ' + info.response);
    });
});





const excelFilePath = path.join(
//    __dirname, 'tEnter.xlsx'
"C:/Users/Hp/OneDrive/Desktop/tEnter.xlsx"
);
const watcher = chokidar.watch(excelFilePath, { persistent: true });

watcher.on('change', async (path) => {
  console.log(`File ${path} has been changed`);
  await mainDataSync(excelFilePath);
});



const logFilePath = "..\\combined.log";
const logWatcher = chokidar.watch(logFilePath, { persistent: true });

logWatcher.on('change', async (path) => {
  console.log(`Log file ${path} has been changed`);
  setTimeout(async () => {
    try {
      await fs.promises.writeFile(logFilePath, 'Log Cleared');
      console.log('Log file has been cleared');
    } catch (error) {
      console.error('Error clearing log file:', error);
    }
  }, 60000);
});



const errorLogFilePath = "..\\error.log";
const errorLogWatcher = chokidar.watch(errorLogFilePath, { persistent: true });

errorLogWatcher.on('change', async (path) => {
  console.log(`Error log file ${path} has been changed`);
  setTimeout(async () => {
    try {
      await fs.promises.writeFile(errorLogFilePath, 'Error Log Cleared');
      console.log('Error log file has been cleared');
    } catch (error) {
      console.error('Error clearing error log file:', error);
    }
  }, 60000);
});




const {syncDataFromSqlServer} = require('./datasync2');
if(1+1==2){
    syncDataFromSqlServer();
 }


app.post('/sync2', async (req, res) => {
try{
    syncDataFromSqlServer();
    console.log('The sync was done succesfully!');
}
catch(error){
console.log('The sync failed');
}

 });


//comment this part only temporart to make testing faster.
// Initial sync on startup
// if (fs.existsSync(excelFilePath)) {
//   mainDataSync( excelFilePath);
// }

// Sync every 5 minutes
// setInterval(() => {
//   if (fs.existsSync(excelFilePath)) {
//     mainDataSync( excelFilePath);
//   }
// }, 5 * 60 * 1000);




// Add this new endpoint near your other endpoints
app.post('/api/trigger-sync', async (req, res) => {
  try {
    await mainDataSync( excelFilePath);
    res.json({ message: 'Data synchronization triggered successfully' });
  } catch (error) {
    logger.error('Error triggering data sync:', error);
    res.status(500).json({ error: 'Failed to trigger data synchronization' });
  }
});










app.post('/api/admin-credentials', (req, res) => {
  const { email, password } = req.body;
  
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.adminUsername = process.env.ADMIN_EMAIL; // Set the session
    return res.json({ success: true });
  }
  return res.json({ success: false });
});




app.post('/api/input/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.insertInput(id);
        if (result === null) {
            res.status(404).send({ message: 'Employee not found' });
        } else {
            res.json({ result });
        }
    } catch (error) {
        console.error('Error handling POST request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

app.patch('/api/update/:id', async (req, res) => {
    try {
        const id = req.params.id;
        console.log("id is",id)
        const result = await db.updateClockOut(id);
        if (result.affectedRows === 0) {
            res.status(404).send({ message: 'Employee not found or no record to update' });
        } else {
            res.json({ message: 'Clock out time updated successfully', result });
        }
    } catch (error) {
        console.error('Error handling PATCH request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});



app.get('/api/employees/:id', async (req, res) => {
    console.log(req.params.id);
     console.log("api is working");
    const id = req.params.id;
    console.log(id);
    const employee = await db.getEmployee(id);
    console.log("app.js ",employee);
    //res.send(employee);
    if (employee === null) {
        res.status(404).send({ message: 'Employee not found' });
      } else {
     res.json({ employee });
      }
})




// Filter options endpoint
app.get('/api/filter-options', async (req, res) => {
    logger.info('Received request for filter options');
    try {
        const options = await db.getFilterOptions();
        logger.debug('Successfully retrieved filter options', { options });
        res.json(options);
    } catch (error) {
        logger.error('Error getting filter options', { 
            error: error.message, 
            stack: error.stack 
        });
        res.status(500).json({ 
            error: 'Failed to retrieve filter options',
            details: error.message 
        });
    }
});



// GAR report 
app.get('/api/attendance-report', async (req, res) => {
    logger.info('Received attendance report request', { query: req.query });
    try {
        const filters = {
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            empId: req.query.empId,
            empName: req.query.empName,
            department: req.query.department,
            site: req.query.site,
            nationality: req.query.nationality,
            visa: req.query.visa
        };

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10000000; // Default to 100 records per page
        const offset = (page - 1) * limit;

        // Validate date range if provided
        if (filters.dateFrom && filters.dateTo) {
            if (new Date(filters.dateFrom) > new Date(filters.dateTo)) {
                throw new Error('Invalid date range: Start date cannot be after end date');
            }
        }

        logger.debug('Processing report with filters and pagination', { filters, page, limit });
        const { report, totalRecords } = await db.generateAttendanceReport(filters, limit, offset);
        logger.info('Successfully generated report', { 
            recordCount: report.length,
            totalRecords
        });
        res.json({ report, totalRecords, page, limit });
    } catch (error) {
        logger.error('Error generating attendance report', { 
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Failed to generate attendance report',
            details: error.message 
        });
    }
});




// Route handler for attendance report
// app.get('/api/attendance-report', async (req, res) => {
//     const { dateFrom, dateTo, empId, empName, department, site, nationality, limit = 100, page = 1 } = req.query;

//     // Construct filters
//     const filters = {};
//     if (dateFrom) filters.dateFrom = dateFrom;
//     if (dateTo) filters.dateTo = dateTo;
//     if (empId) filters.empId = empId;
//     if (empName) filters.empName = empName;
//     if (department) filters.department = department;
//     if (site) filters.site = site;
//     if (nationality) filters.nationality = nationality;

//     // Pagination
//     const limitNum = parseInt(limit, 10);
//     const pageNum = parseInt(page, 10);
//     const offset = (pageNum - 1) * limitNum;

//     try {
//         // Count total records
//         const countSQL = `
//             SELECT COUNT(*) as total
//             FROM general_attendance_report gar
//             JOIN employee_master em ON gar.emp_id = em.EmpID
//             JOIN departments d ON em.depId = d.depId
//             JOIN shift s ON em.ShiftId = s.Shift_id
//             JOIN section sec ON d.section_Id = sec.sectionId
//             JOIN sites st ON sec.site_id = st.siteId
//             JOIN nationalities n ON em.nationalityId = n.nationalityId
//             WHERE 1=1
//             ${filters.dateFrom ? 'AND gar.shift_date >= ?' : ''}
//             ${filters.dateTo ? 'AND gar.shift_date <= ?' : ''}
//             ${filters.empId ? 'AND gar.emp_id = ?' : ''}
//             ${filters.empName ? 'AND (em.EmpFName LIKE ? OR em.EmpLName LIKE ?)' : ''}
//             ${filters.department ? 'AND d.depName = ?' : ''}
//             ${filters.site ? 'AND st.siteName = ?' : ''}
//             ${filters.nationality ? 'AND n.NationalityName = ?' : ''}
//         `;
//         const countValues = [];
//         if (filters.dateFrom) countValues.push(filters.dateFrom);
//         if (filters.dateTo) countValues.push(filters.dateTo);
//         if (filters.empId) countValues.push(filters.empId);
//         if (filters.empName) {
//             countValues.push(`%${filters.empName}%`, `%${filters.empName}%`);
//         }
//         if (filters.department) countValues.push(filters.department);
//         if (filters.site) countValues.push(filters.site);
//         if (filters.nationality) countValues.push(filters.nationality);
//         const countResult = await db.queryDB(countSQL, countValues);
//         const totalRecords = countResult[0]?.total || 0;

//         // Fetch the actual report data
//         const reportSQL = `
//             SELECT
//                 gar.emp_id,
//                 em.EmpFName,
//                 em.EmpLName,
//                 gar.shift_date,
//                 gar.first_in,
//                 gar.last_out,
//                 gar.status,
//                 gar.leave_id,
//                 gar.awh,
//                 gar.ot
//             FROM general_attendance_report gar
//             JOIN employee_master em ON gar.emp_id = em.EmpID
//             JOIN departments d ON em.depId = d.depId
//             JOIN shift s ON em.ShiftId = s.Shift_id
//             JOIN section sec ON d.section_Id = sec.sectionId
//             JOIN sites st ON sec.site_id = st.siteId
//             JOIN nationalities n ON em.nationalityId = n.nationalityId
//             WHERE 1=1
//             ${filters.dateFrom ? 'AND gar.shift_date >= ?' : ''}
//             ${filters.dateTo ? 'AND gar.shift_date <= ?' : ''}
//             ${filters.empId ? 'AND gar.emp_id = ?' : ''}
//             ${filters.empName ? 'AND (em.EmpFName LIKE ? OR em.EmpLName LIKE ?)' : ''}
//             ${filters.department ? 'AND d.depName = ?' : ''}
//             ${filters.site ? 'AND st.siteName = ?' : ''}
//             ${filters.nationality ? 'AND n.NationalityName = ?' : ''}
//             ORDER BY gar.shift_date DESC
//             LIMIT ? OFFSET ?
//         `;
//         const reportValues = [...countValues, limitNum, offset];
//         const reportData = await db.queryDB(reportSQL, reportValues);

//         // Construct response
//         const response = {
//             recordCount: reportData.length,
//             totalRecords,
//             data: reportData
//         };
//         res.json(response);
//         logger.info('Successfully generated report', { recordCount: reportData.length, totalRecords, timestamp: new Date().toISOString() });
//     } catch (err) {
//         logger.error('Error generating attendance report', {
//             error: err.message,
//             stack: err.stack
//         });
//         res.status(500).json({
//             error: 'Failed to generate attendance report',
//             details: err.message
//         });
//     }
// });






//the Admin Crud endoints

async function getPrimaryKeys(table) {
    const query = `
        SELECT k.COLUMN_NAME
        FROM information_schema.table_constraints t
        JOIN information_schema.key_column_usage k
        USING(constraint_name,table_schema,table_name)
        WHERE t.constraint_type='PRIMARY KEY'
          AND t.table_schema=DATABASE()
          AND t.table_name=?;
    `;
    return await db.executeQuery(query, [table]);
}



app.get('/tableInfo/:table', async (req, res) => {
    try {
        const TABLE = req.params.table;
        // Validate table name to prevent SQL injection
        const validTables = ['accommodation', 'asst_master', 'company', 'departments', 'employee_master', 'general_attendance_report', 'grade', 'holidays', 'input_data', 'jobtitle', 'nationalities', 'section', 'shift', 'sites', 'test_user', 'visa', 'weekend','muster_roll'];
        if (!validTables.includes(TABLE)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }
        
// if(TABLE==input_data){
// }

        console.log(`Attempting to fetch data from table: ${TABLE}`);
        const primaryKeys = await getPrimaryKeys(TABLE);
        const data = await db.executeQuery(`SELECT * FROM ${TABLE}`);
        console.log(`Data fetched from ${TABLE}:`, data);
        
        if (data.length === 0) {
            console.log(`No data found in table: ${TABLE}`);
            return res.json({ primaryKeys: primaryKeys.map(pk => pk.COLUMN_NAME), data: [] });
        }
        
        res.json({ primaryKeys: primaryKeys.map(pk => pk.COLUMN_NAME), data });
    } catch (error) {
        console.error(`Error fetching data from table ${req.params.table}:`, error);
        res.status(500).json({ error: error.message });
    }
});
  

app.post('/updateTable', async (req, res) => {
    try {
        const { table, primaryKeys, primaryKeyValues, column, value } = req.body;
        console.log('Update request:', { table, primaryKeys, primaryKeyValues, column, value });

        const whereClause = primaryKeys.map((key, index) => `${key} = ?`).join(' AND ');
        const sql = `UPDATE ${table} SET ${column} = ? WHERE ${whereClause}`;
        console.log('SQL query:', sql);

        const result = await db.executeQuery(sql, [value, ...primaryKeyValues]);
        console.log('Update result:', result);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/insertRow', async (req, res) => {
    try {
        const { table, row } = req.body;
        console.log('Insert request:', { table, row });

        const columns = Object.keys(row).join(', ');
        const placeholders = Object.keys(row).map(() => '?').join(', ');
        const values = Object.values(row);

        const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
        console.log('SQL query:', sql);

        const result = await db.executeQuery(sql, values);
        console.log('Insert result:', result);
        res.json({ success: true });
    } catch (error) {
        console.error('Error inserting row:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/deleteRow', async (req, res) => {
    try {
        const { table, primaryKeys, rowData } = req.body;
        console.log('Delete request:', { table, primaryKeys, rowData });

        const whereClause = primaryKeys.map(key => `${key} = ?`).join(' AND ');
        const values = primaryKeys.map(key => rowData[key]);

        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        console.log('SQL query:', sql);

        const result = await db.executeQuery(sql, values);
        console.log('Delete result:', result);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting row:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/filteredAttendance', async (req, res) => {
    try {
        const { startDate, endDate, empId, empName, status, page, rowsPerPage } = req.query;
                let whereConditions = [];
        let params = [];

        if (startDate && endDate) {
            whereConditions.push('shift_date BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }
        if (empId) {
            whereConditions.push('emp_id = ?');
            params.push(empId);
        }
        if (empName) {
            whereConditions.push('FullName LIKE ?');
            params.push(`%${empName}%`);
        }
        if (status) {
            whereConditions.push('status = ?');
            params.push(status);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Handle pagination
        let limitClause = '';
        let limitParams = [];

        if (rowsPerPage && rowsPerPage !== 'All') {
            const offset = (parseInt(page) - 1) * parseInt(rowsPerPage);
            limitClause = 'LIMIT ? OFFSET ?';
            limitParams.push(parseInt(rowsPerPage), offset);
        }

        // Query to get total number of rows matching the filters (for pagination)
        const countQuery = `
            SELECT COUNT(*) AS totalRows FROM general_attendance_report 
            ${whereClause}
        `;
        const countResult = await db.executeQuery(countQuery, params);
        const totalRows = countResult[0].totalRows;

        const query = `
        SELECT * FROM general_attendance_report 
        ${whereClause}
        ORDER BY shift_date
        ${limitClause}
    `;

    const data = await db.executeQuery(query, [...params, ...limitParams]);
    res.json({ success: true, data, totalRows });
} catch (error) {
    console.error('Error fetching filtered data:', error);
    res.status(500).json({ success: false, error: error.message });
}
});

app.post('/bulkUpdate', async (req, res) => {
    try {
        const { column, value, filters } = req.body;
        let whereConditions = [];
        let params = [value]; // First parameter is the new value

        if (filters.startDate && filters.endDate) {
            whereConditions.push('shift_date BETWEEN ? AND ?');
            params.push(filters.startDate, filters.endDate);
        }
        if (filters.empId) {
            whereConditions.push('emp_id = ?');
            params.push(filters.empId);
        }
        if (filters.empName) {
            whereConditions.push('FullName LIKE ?');
            params.push(`%${filters.empName}%`);
        }
        if (filters.status) {
            whereConditions.push('status = ?');
            params.push(filters.status);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const query = `
            UPDATE general_attendance_report 
            SET ${column} = ?
            ${whereClause}`;

        const result = await db.executeQuery(query, params);
        res.json({ success: true, rowsAffected: result.affectedRows });
    } catch (error) {
        console.error('Error performing bulk update:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});









app.get('/isClockedin/:id', async (req, res) => {
    console.log("this is the api working");
    const id = req.params.id
    const report = await db.IsclockedIn(id);
    console.log(report);
    res.json(report);

})

app.get('/api/departments', async (req, res) => {
    try {
        const departments = await db.getDepartments();
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/data', async (req, res) => {
    try {
      const query = 'SELECT * FROM your_table_name';
      const [rows] = await db.execute(query);
      res.json(rows);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  











//Dashboard endpoints

  const nationalityMap = {
    1: 'India',
    2: 'Turkey',
    3: 'United Arab Emirates',
    4: 'Nepal',
    5: 'Egypt',
    6: 'Bangladesh',
    7: 'Pakistan',
    8: 'Canada',
    9: 'Jordan',
    10: 'Oman',
    11: 'United Kingdom'
};

const departmentMap = {
    1: 'Engineering',
    2: 'Finance',
    3: 'HR & Admin',
    4: 'Information Technology',
    5: 'Management',
    6: 'Operations',
    7: 'QHSSE',
    8: 'Sales & Marketing',
    9: 'Supply Chain'
};

const siteMap = {
    1: 'ICAD 2',
    2: 'ICAD 1',
    3: 'M46'
};
// Function to calculate overall attendance
function calculateAttendance(data) {
    let present = 0;
    let absent = 0;
    let Ms = 0;

    data.forEach(record => {
        const { clock_in, clock_out } = record;

        if (clock_in && clock_out) {
            present += 1;
        } else if (clock_in || clock_out) {
            Ms += 1;
        }
    });

    // Assuming total number of employees is 456
    absent = 456 - present - Ms;

    return { present, absent, Ms };
}

app.get('/api/attendance', async (req, res) => {
    const { date } = req.query;
  
    if (!date) {
      return res.status(400).json({ error: 'Please provide a date parameter' });
    }
  
    const query = `
      SELECT empid, date, clock_in, clock_out
      FROM input_data
      WHERE date = ?
    `;
  
    try {
      const results = await db.executeQuery(query, [date]);
      const attendance = calculateAttendance(results);
      res.json(attendance);
    } catch (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: err.message });
    }
  });
  

app.get('/api/attendance-distribution', (req, res) => {
    const { date, type } = req.query;

    if (!date || !type) {
        return res.status(400).json({ error: 'Please provide date and type parameters' });
    }

    let groupField = '';
    let nameMap = {};

    if (type === 'nationality') {
        groupField = 'e.NationalityID';
        nameMap = nationalityMap;
    } else if (type === 'department') {
        groupField = 'e.DepId';
        nameMap = departmentMap;
    } else if (type === 'location') {
        groupField = 'e.SiteId';
        nameMap = siteMap;
    } else {
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    const query = `
        SELECT ${groupField} AS groupId, COUNT(DISTINCT e.EmpID) AS employeeCount
        FROM employee_master e
        JOIN input_data i ON e.EmpID = i.empid
        WHERE i.date = ?
        GROUP BY ${groupField}
    `;

    db.executeQuery(query, [date])
        .then(results => {
            const data = results.map(record => ({
                id: record.groupId,
                label: nameMap[record.groupId] || `Unknown (${record.groupId})`,
                count: record.employeeCount
            }));
            res.json(data);
        })
        .catch(err => {
            console.error('Error executing query:', err);
            res.status(500).json({ error: err.message });
        });
});

app.get('/api/visa-distribution', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
        SELECT v.visaType, COUNT(*) AS count
        FROM employee_master e
        JOIN visa v ON e.VisaId = v.visaId
        JOIN input_data i ON e.EmpID = i.empid
        WHERE i.date = ? AND i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL
        GROUP BY v.visaType
    `;

    db.executeQuery(query, [date])
        .then(results => {
            res.json(results);
        })
        .catch(err => {
            console.error('Error executing query:', err);
            res.status(500).json({ error: err.message });
        });
});

app.get('/api/employee-attendance', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
        SELECT e.EmpID, e.FullName, e.EmailID, v.visaType,
               CASE 
                   WHEN i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL THEN 'Present'
                   WHEN i.clock_in IS NULL AND i.clock_out IS NULL THEN 'Absent'
                   ELSE 'Ms'
               END AS attendanceStatus
        FROM employee_master e
        JOIN visa v ON e.VisaId = v.visaId
        LEFT JOIN input_data i ON e.EmpID = i.empid AND i.date = ?
    `;

    db.executeQuery(query, [date])
        .then(results => {
            res.json(results);
        })
        .catch(err => {
            console.error('Error executing query:', err);
            res.status(500).json({ error: err.message });
        });
});



app.get('/api/employee-attendance1', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
    SELECT e.EmpID AS Id, e.FullName AS Name,
           CASE 
               WHEN i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL THEN 'P'
               WHEN i.clock_in IS NULL AND i.clock_out IS NULL THEN 'A'
               ELSE 'Ms'
           END AS Status
    FROM employee_master e
    LEFT JOIN input_data i ON e.EmpID = i.empid AND i.date = STR_TO_DATE(?, '%Y-%m-%d')
`;

    db.executeQuery(query, [date])
        .then(results => {
            res.json(results);
        })
        .catch(err => {
            console.error('Error executing query:', err);
            res.status(500).json({ error: err.message });
        });
});



// muster report 

async function fillMusterRollTable(limit = 50000000000) {
    const query = `
      SELECT 
        e.EmpID, 
        e.FullName, 
        e.NationalityID,  
        CAST(i.date AS DATE) as date, 
        i.clock_in, 
        i.clock_out, 
        COALESCE(gar.leave_id, NULL) as leave_id
      FROM 
        employee_master e
        JOIN input_data i ON e.EmpID = i.empid
        LEFT JOIN general_attendance_report gar ON e.EmpID = gar.emp_id AND i.date = gar.shift_date
      ORDER BY 
        EmpID,
        date
      LIMIT ?
    `;
  
    try {
      const results = await db.query(query, [limit]);
      console.log('Data retrieved:', results.length);
  
      // Fetch existing records within the same date range
      const dateRange = results.map(record => record.date);
      const minDate = new Date(Math.min(...dateRange));
      const maxDate = new Date(Math.max(...dateRange));
  
      const existingQuery = `
        SELECT emp_id, shift_date, clock_in, clock_out, leave_id, Nationalityid
        FROM muster_roll
        WHERE shift_date BETWEEN ? AND ?
      `;
      const existingRecords = await db.query(existingQuery, [minDate, maxDate]);
      const existingMap = new Map(existingRecords.map(record => [`${record.emp_id}-${record.shift_date}`, record]));
  
      const inserts = [];
      const updates = [];
  
      results.forEach(record => {
        const key = `${record.EmpID}-${record.date}`;
        const existing = existingMap.get(key);
  
        if (!existing) {
          inserts.push([
            record.EmpID, 
            record.FullName, 
            record.NationalityID, // Added this field
            record.date, 
            record.clock_in, 
            record.clock_out, 
            record.leave_id
          ]);
        } else if (
          existing.clock_in !== record.clock_in ||
          existing.clock_out !== record.clock_out ||
          existing.leave_id !== record.leave_id ||
          existing.Nationalityid !== record.NationalityID // Added this condition
        ) {
          updates.push([
            record.FullName, 
            record.clock_in, 
            record.clock_out, 
            record.leave_id, 
            record.NationalityID, // Added this field
            record.EmpID, 
            record.date
          ]);
        }
      });
  
      const batchSize = 100; // Adjust batch size based on your system's capability
  
      for (let i = 0; i < inserts.length; i += batchSize) {
        const batchInserts = inserts.slice(i, i + batchSize);
        const insertQuery = `
          INSERT INTO muster_roll (emp_id, emp_name, Nationalityid, shift_date, clock_in, clock_out, leave_id)
          VALUES ${batchInserts.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}
        `;
        const insertValues = batchInserts.flat();
        await db.query(insertQuery, insertValues);
      }
  
      for (let i = 0; i < updates.length; i += batchSize) {
        const batchUpdates = updates.slice(i, i + batchSize);
        const updatePromises = batchUpdates.map(update => {
          const updateQuery = `
            UPDATE muster_roll
            SET emp_name = ?, clock_in = ?, clock_out = ?, leave_id = ?, Nationalityid = ?
            WHERE emp_id = ? AND shift_date = ?
          `;
          return db.query(updateQuery, update);
        });
        await Promise.all(updatePromises);
      }
  
      const finalUpdateQuery = `
        UPDATE muster_roll mr
        JOIN general_attendance_report gar ON mr.emp_id = gar.emp_id AND mr.shift_date = gar.shift_date
        SET mr.leave_id = gar.leave_id
      `;
      await db.query(finalUpdateQuery);
  
      console.log('Muster roll table updated successfully.');
  
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }
  
  app.get('/fill-muster-roll-table', async (req, res) => {
    const limit = req.query.limit || 5000000000;
    try {
      await fillMusterRollTable(limit);
      res.send('Muster roll table updated successfully.');
    } catch (error) {
      console.error('Error updating muster roll table:', error);
      res.status(500).send('Error updating muster roll table');
    }
  });
  
  app.get('/fetch-muster-roll', async (req, res) => {
    try {
      const limit = req.query.limit || 5000000000;
      await fillMusterRollTable(limit);
      const query = `
        SELECT 
          emp_id, 
          emp_name, 
          Nationalityid,  
          DATE_FORMAT(shift_date, "%Y-%m-%d") as shift_date, 
          clock_in, 
          clock_out, 
          leave_id
        FROM 
          muster_roll
        LIMIT ?
      `;
      const results = await db.query(query, [limit]);
      res.json(results);
    } catch (err) {
      console.error('Query error:', err);
      res.status(500).send('Internal Server Error');
    }
  });


  

// login for system user 
app.post('/login', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    const results = await db.query(`SELECT * FROM user WHERE username = ? AND password = ?`, [username, password]);

    if (results.length === 0) {
      res.status(401).send({ message: 'Invalid username or password' });
    } else {
      req.session.username = username;
      res.send({ message: 'Login successful' });
    }
  } catch (err) {
    console.error('error running query:', err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});


//session info
app.get('/session-info', (req, res) => {
    res.send({ session: req.session });
  });


app.get('/email', (req, res) => {
        res.sendFile(path.join(__dirname,'..','Client','email.html'));
        });

app.get('/muster_roll', (req, res) => {
  if (!req.session.username) {
    res.redirect('/loginSite.html');
  } else {
    res.sendFile(path.join(__dirname, '..', 'Client', 'muster_roll.html'));
  }
});






app.get('/Clocking', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Clocking.html'));
});

app.get('/gar', (req, res) => {
  if (!req.session.username) {
    res.redirect('/loginSite.html');
  } else {
    res.sendFile(path.join(__dirname,'..','Client','GAR2.html'));
  }
});

app.get('/Dashboard', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Dashboard.html'));
});

app.get('/Admin_CRUD.html', (req, res) => {
  if (!req.session.adminUsername) {
    return res.redirect('/login.html');
  } else {
    return res.sendFile(path.join(__dirname, '..', 'Client', 'Admin_CRUD.html'));
  }
});


//site login
app.get('/loginSite.html', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','loginSite.html'));
});

//dashboard
app.get('/', (req, res) => {
    if (!req.session.username) {
      res.redirect('/loginSite.html');
    } else {
      res.sendFile(path.join(__dirname, '..', 'Client', '/home.html'));
    }
  });

//admin login
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','login.html'));
});

//home

app.get('/home.html', (req, res) => {
  if (!req.session.username) {
    res.redirect('/loginSite.html');
  } else {
    res.sendFile(path.join(__dirname, '..', 'Client', 'home.html'));
  }
});

//signout
app.post('/signout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    } else {
      res.send();
    }
  });
});

  



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


//test
