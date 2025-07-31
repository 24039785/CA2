const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// File upload storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'Republic_C207',
  database: 'flareair',
});

connection.connect((err) => {
  if (err) return console.error('The Bluetooth Device not successfully connected', err);
  console.log('The Bluetooth Device is successfully connected');
});

// Middleware & View setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);
app.use(flash());

// Auth middleware
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  req.flash('error', 'Please login!!');
  res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session.user.role === 'admin') return next();
  req.flash('error', 'Access denied');
  res.redirect('/locations');
};

// Registration validation
const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;
  if (!username || !email || !password || !address || !contact || !role)
    return res.status(400).send('All fields are required.');
  if (password.length < 6) {
    req.flash('error', 'Password should be at least 6 or more characters long');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }
  next();
};

// Routes
app.get('/', (req, res) => {
  res.render('dex', { user: req.session.user });
});

app.get('/register', (req, res) => {
  res.render('rg', {
    messages: req.flash('error'),
    formData: req.flash('formData')[0],
  });
});

app.post('/register', validateRegistration, (req, res) => {
  const { username, email, password, address, contact, role } = req.body;
  const sql =
    'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
  connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
    if (err) throw err;
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  });
});

app.get('/login', (req, res) => {
  res.render('lg', {
    messages: req.flash('success'),
    errors: req.flash('error'),
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'All fields are required!!.');
    return res.redirect('/login');
  }
  const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
  connection.query(sql, [email, password], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      req.session.user = results[0];
      req.flash('success', 'Login successful!');
      if (req.session.user.role == 'user') res.redirect('/booking');
      else res.redirect('/location');
    } else {
      req.flash('error', 'Invalid email or password.');
      res.redirect('/login');
    }
  });
});

app.get('/booking', checkAuthenticated, (req, res) => {
  connection.query('SELECT * FROM bookings', (error, results) => {
    if (error) throw error;
    res.render('booking', { user: req.session.user, bookings: results });
  });
});

app.post('/add-to-booking/:id', checkAuthenticated, (req, res) => {
  const bookingid = parseInt(req.params.id);
  const quantity = parseInt(req.body.quantity) || 1;

  connection.query('SELECT * FROM bookings WHERE bookingid = ?', [bookingid], (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
      const booking = results[0];
      if (!req.session.cart) req.session.cart = [];

      const existingItem = req.session.cart.find((item) => item.bookingid === bookingid);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        req.session.cart.push({
          bookingid: booking.bookingid,
          productName: booking.location,
          image: booking.image,
          quantity,
        });
      }

      res.redirect('/cart');
    } else {
      res.status(404).send('Location not found');
    }
  });
});

app.get('/cart', checkAuthenticated, (req, res) => {
  const cart = req.session.cart || [];
  res.render('cart', { cart, user: req.session.user });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/location', checkAuthenticated, checkAdmin, (req, res) => {
  connection.query('SELECT * FROM bookings', (error, results) => {
    if (error) throw error;
    res.render('location', { bookings: results, user: req.session.user });
  });
});

app.get('/location/:id', checkAuthenticated, (req, res) => {
  const bookingid = req.params.id;
  connection.query('SELECT * FROM bookings WHERE bookingid = ?', [bookingid], (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
      res.render('booking', { booking: results[0], user: req.session.user });
    } else {
      res.status(404).send('Location not found');
    }
  });
});

app.get('/addlocation', checkAuthenticated, checkAdmin, (req, res) => {
  res.render('addlocation', { user: req.session.user });
});

app.post('/addlocation', upload.single('image'), (req, res) => {
  const { name } = req.body;
  const image = req.file ? req.file.filename : null;
  const sql = 'INSERT INTO bookings (location, image) VALUES (?, ?)';
  connection.query(sql, [name, image], (error) => {
    if (error) {
      console.error('Error adding location:', error);
      res.status(500).send('Error adding location');
    } else {
      res.redirect('/location');
    }
  });
});

app.get('/updatelocation/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const bookingid = req.params.id;
  const sql = 'SELECT * FROM bookings WHERE bookingid = ?';
  connection.query(sql, [bookingid], (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
      res.render('updatelocation', { location: results[0] });
    } else {
      res.status(404).send('Location not found');
    }
  });
});

app.post('/updatelocation/:id', upload.single('image'), (req, res) => {
  const bookingid = req.params.id;
  const { location } = req.body;
  let image = req.body.currentImage;
  if (req.file) image = req.file.filename;

  const sql = 'UPDATE bookings SET location = ?, image = ? WHERE bookingid = ?';
  connection.query(sql, [location, image, bookingid], (error) => {
    if (error) {
      console.error('Error updating location:', error);
      res.status(500).send('Error updating location');
    } else {
      res.redirect('/location');
    }
  });
});

app.get('/deletebooking/:id', (req, res) => {
  const bookingid = req.params.id;
  connection.query('DELETE FROM bookings WHERE bookingid = ?', [bookingid], (error) => {
    if (error) {
      console.error('Error deleting location:', error);
      res.status(500).send('Error deleting location');
    } else {
      res.redirect('/location');
    }
  });
});

app.listen(4000, () => {
  console.log('Server started on port 4000');
});
