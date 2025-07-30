const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images'); // Directory to save uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
  host: 'c237-all.mysql.database.azure.com',
  port: 3306,
  user: 'c237admin',
  password: 'c2372025!',
  database: 'c237_ca2db_021_t3',
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(
  express.urlencoded({
    extended: false,
  })
);

//TO DO: Insert code for Session Middleware below
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  } else {
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
  }
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  } else {
    req.flash('error', 'Access denied. Admins only.');
    res.redirect('/login');
  }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;

  // Check required fields
  if (!username || !email || !password || !address || !contact || !role) {
    req.flash('error', 'All fields are required.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  // Check password length
  if (password.length < 6) {
    req.flash('error', 'Password must be at least 6 characters long.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }
  next();
};

// Landing page
app.get('/', (req, res) => {
  res.render('landing'); // landing.ejs with "Login" and "Register" buttons
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', {
    messages: req.flash('success'), // Green success alerts
    errors: req.flash('error'), // Red error alerts
  });
});

// Register page
app.get('/register', (req, res) => {
  res.render('register', {
    messages: req.flash('success'), // Green success alerts
    errors: req.flash('error'), // Red error alerts
    formData: {},
  });
});

// handle register Submission
app.post('/register', validateRegistration, (req, res) => {
  const { username, email, password, address, contact, role } = req.body;

  // Force role to "user" for security
  const userRole = 'user';
  const sql = `INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)`;

  connection.query(sql, [username, email, password, address, contact, userRole], (err, result) => {
    if (err) {
      console.error('Registration error:', err);

      // Handle duplicate email error specifically
      if (err.code === 'ER_DUP_ENTRY') {
        req.flash('messages', ['Email is already registered. Please log in or use another email.']);
      } else {
        req.flash('messages', ['Registration failed. Please try again.']);
      }
      return res.redirect('/register');
    }

    console.log('User registered:', result);

    req.flash('messages', ['Registration successful! Please log in.']);
    res.redirect('/login');
  });
});

// Handle Login Submission
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Check for empty fields
  if (!email || !password) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/login');
  }

  const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
  connection.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error('Database error during login:', err);
      req.flash('error', 'An unexpected error occurred. Please try again.');
      return res.redirect('/login');
    }

    if (results.length > 0) {
      // User found, start a session
      req.session.user = results[0];
      req.flash('success', 'Login successful!');

      // Redirect based on role
      if (results[0].role === 'admin') {
        res.redirect('/admin');
      } else {
        res.redirect('/dashboard');
      }
    } else {
      // Invalid credentials
      req.flash('error', 'Invalid email or password.');
      res.redirect('/login');
    }
  });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
  const search = req.query.search;

  let sql = 'SELECT * FROM bookings';
  let params = [];

  if (search && search.trim() !== '') {
    sql += ' WHERE name LIKE ? OR roomType LIKE ?';
    const likeSearch = `%${search}%`;
    params.push(likeSearch, likeSearch);
  }

  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).send('Error retrieving bookings');
    }
    res.render('dashboard', {
      user: req.session.user,
      bookings: results,
      search: search || ''
    });
  });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  const sql = 'SELECT * FROM bookings';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).send('Error retrieving bookings');
    }
    res.render('admin', {
      user: req.session.user,
      bookings: results,
    });
  });
});

// DELETE hotel booking by ID
app.get('/admin/delete/:id', (req, res) => {
    const bookingId = req.params.id;

    const sql = 'DELETE FROM bookings WHERE bookingId = ?';
    connection.query(sql, [bookingId], (err, result) => {
        if (err) {
            console.error('Error deleting booking:', err);
            return res.status(500).send('Database error');
        }
        console.log(`Booking with ID ${bookingId} deleted successfully.`);
        res.redirect('/admin'); // reloads the admin page
    });
});


// //nash
// //search hotels for admin
// app.get('/AdminSearch', (req, res) => {
//     const bookings = req.query.q;

//     const sql = "SELECT * FROM bookings WHERE name LIKE ? LIMIT 1";
//     connection.query(sql, [%${bookings}%], (err, results) => {
//         if (err) throw err;

//         if (results.length > 0) {
//             res.redirect(/hotels/${results[0].id});
//         } else {
//             res.send("Hotel not found");
//         }
//     });
// });

app.get('/admin/search', checkAuthenticated, (req, res) => {
    const keyword = `%${req.query.keyword}%`;
    const sql = `SELECT * FROM bookings WHERE name LIKE ?`;

    connection.query(sql, [keyword], (err, results) => {
        if (err) throw err;

        res.render('admin', {
            bookings: results,
            users: req.session.users
        });
    });
});


app.get('/hotels/:id', (req, res) => {
    const hotelId = req.params.id;

    connection.query('SELECT * FROM bookings WHERE bookingId = ?', [hotelId], (err, results) => {
        if (err) {
            console.error('Detail error:', err.message);
            return res.status(500).send("Database error");
        }

        if (results.length > 0) {
            res.render('admin', {
                hotels: results, 
                users: req.session.users 
            });
        } else {
            res.send('Hotel not found');
        }
    });
});

//^^nash^^
//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Route to render the Add Hotel form
// Show add hotel form (only admin)
app.get('/add', checkAuthenticated, checkAdmin, (req, res) => {
  res.render('add', {
    messages: req.flash('error'),
    formData: {},
    user: req.session.user, // Pass user to the view
  });
});

// Handle add hotel form submission
app.post('/add', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const { name, location, roomType, isAvailable } = req.body;
  let image = '';

  if (req.file) {
    image = '/images/' + req.file.filename;
  }

  // Validate required fields
  if (!name || !location || !roomType) {
    req.flash('error', 'Please fill in all required fields.');
    return res.render('add', {
      messages: req.flash('error'),
      formData: req.body,
      user: req.session.user, // Pass user here too
    });
  }

  const available = isAvailable === 'on' ? 1 : 0;

  const sql = `INSERT INTO bookings (name, location, roomType, isAvailable, image) VALUES (?, ?, ?, ?, ?)`;

  connection.query(sql, [name, location, roomType, available, image], (err, result) => {
    if (err) {
      console.error('Error adding hotel:', err);
      req.flash('error', 'Failed to add hotel. Please try again.');
      return res.render('add', {
        messages: req.flash('error'),
        formData: req.body,
        user: req.session.user,
      });
    }

    req.flash('success', 'Hotel added successfully!');
    res.redirect('/admin');
  });
});

// GET: Show booking form (user books hotel)
app.get('/add-booking', checkAuthenticated, (req, res) => {
  const sql = 'SELECT * FROM bookings WHERE isAvailable = 1';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching hotels:', err);
      req.flash('error', 'Unable to load available hotels.');
      return res.redirect('/dashboard');
    }
    res.render('add-booking', {
      user: req.session.user,
      hotels: results,
      messages: req.flash('error'),
    });
  });
});

// POST: Handle booking submission
app.post('/add-booking', checkAuthenticated, (req, res) => {
  const { bookingId, checkIn, checkOut } = req.body;
  const userId = req.session.user.id;

  if (!bookingId || !checkIn || !checkOut) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/add-booking');
  }

  const sql = `INSERT INTO user_bookings (userId, bookingId, checkIn, checkOut) VALUES (?, ?, ?, ?)`;

  connection.query(sql, [userId, bookingId, checkIn, checkOut], (err, result) => {
    if (err) {
      console.error('Booking error:', err);
      req.flash('error', 'Failed to book. Please try again.');
      return res.redirect('/add-booking');
    }

    req.flash('success', 'Booking successful!');
    res.redirect('/dashboard');
  });
});

// King
// Admin: View all users
app.get('/admin/edit-users', checkAuthenticated, checkAdmin, (req, res) => {
  const sql = 'SELECT * FROM users';
  connection.query(sql, (err, users) => {
    if (err) {
      console.error('Error retrieving users:', err);
      req.flash('error', 'Unable to fetch users.');
      return res.redirect('/admin');
    }
    res.render('userList', { users, messages: req.flash('error') });
  });
});

// Show edit form for a user
app.get('/admin/edit-user/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const userId = req.params.id;
  const sql = 'SELECT * FROM users WHERE id = ?';
  connection.query(sql, [userId], (err, results) => {
    if (err || results.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/edit-users');
    }
    res.render('edit', { formData: results[0], messages: req.flash('error') });
  });
});

// Handle edit form submission
app.post('/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const userId = req.params.id;
  const { username, email, password, address, contact, role } = req.body;

  let sql, values;

  if (password) {
    sql = `UPDATE users SET username = ?, email = ?, password = SHA1(?), address = ?, contact = ?, role = ? WHERE id = ?`;
    values = [username, email, password, address, contact, role, userId];
  } else {
    sql = `UPDATE users SET username = ?, email = ?, address = ?, contact = ?, role = ? WHERE id = ?`;
    values = [username, email, address, contact, role, userId];
  }

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error updating user:', err);
      req.flash('error', 'Failed to update user.');
      return res.redirect('/admin/edit-user/' + userId);
    }

    req.flash('success', 'User updated successfully.');
    res.redirect('/admin/edit-users');
  });
});

// Edit Hotel
// Render edit hotel form
app.get('/admin/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const bookingId = req.params.id;
  const sql = 'SELECT * FROM bookings WHERE bookingId = ?';

  connection.query(sql, [bookingId], (err, results) => {
    if (err || results.length === 0) {
      console.error('Error retrieving hotel:', err);
      req.flash('error', 'Hotel not found.');
      return res.redirect('/admin');
    }
    res.render('edit-hotel', { booking: results[0] });
  });
});

// Handle hotel edit form submission
app.post('/admin/edit/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const bookingId = req.params.id;
  const { name, location, roomType, isAvailable, existingImage } = req.body;
  const availability = isAvailable ? 1 : 0;

  let imagePath = existingImage; // default to old image
  if (req.file) {
    imagePath = '/images/' + req.file.filename;
  }

  const sql = `UPDATE bookings 
                 SET name = ?, location = ?, roomType = ?, image = ?, isAvailable = ? 
                 WHERE bookingId = ?`;

  connection.query(
    sql,
    [name, location, roomType, imagePath, availability, bookingId],
    (err, result) => {
      if (err) {
        console.error('Error updating hotel:', err);
        req.flash('error', 'Failed to update hotel.');
        return res.redirect('/admin/edit/' + bookingId);
      }

      req.flash('success', 'Hotel updated successfully.');
      res.redirect('/admin');
    }
  );
});

// User edits profile
app.get('/edit-profile', checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  const sql = 'SELECT * FROM users WHERE id = ?';
  connection.query(sql, [userId], (err, results) => {
    if (err || results.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/dashboard');
    }

    res.render('edit-profile', {
      formData: results[0],
      messages: req.flash('error'),
      user: req.session.user
    });
  });
});

app.post('/edit-profile', checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const { username, email, password, address, contact } = req.body;

  let sql, values;

  if (password) {
    sql = `UPDATE users SET username = ?, email = ?, password = SHA1(?), address = ?, contact = ? WHERE id = ?`;
    values = [username, email, password, address, contact, userId];
  } else {
    sql = `UPDATE users SET username = ?, email = ?, address = ?, contact = ? WHERE id = ?`;
    values = [username, email, address, contact, userId];
  }

  connection.query(sql, values, (err) => {
    if (err) {
      console.error('Update error:', err);
      req.flash('error', 'Failed to update profile.');
      return res.redirect('/edit-profile');
    }

    // Update session info (optional but recommended)
    req.session.user.username = username;
    req.session.user.email = email;

    req.flash('success', 'Profile updated successfully!');
    res.redirect('/dashboard');
  });
});




// Starting the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
