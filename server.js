const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const JWT_SECRET = 'mySimpleSecret';
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

const noteSchema = new mongoose.Schema({
  title: String,
  tags: String,
  content: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});
const Note = mongoose.model('Note', noteSchema);
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

function authenticateJWT(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    res.redirect('/login');
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next(); 
  });
}

async function startApp() {
  try {
    await mongoose.connect('mongodb+srv://sooriyab:xiAVcHIg12snaQvh@cluster0.49wjisg.mongodb.net/');
    console.log('✅ Connected to MongoDB');

    app.post('/signup', async (req, res) => {
      const { email, password } = req.body;

      try {
        const user = await User.create({ email, password });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, {
          expiresIn: '1h',
        });
        res.cookie('token', token, { httpOnly: true, maxAge: 3600 * 1000 });
        res.redirect('/login');
      } catch (err) {
        console.log(err);
        res.status(400).json({ error: 'Registration failed' });
      }
    });

    app.post('/login', async (req, res) => {
      const { email, password } = req.body;

      try {
        const user = await User.findOne({ email });
        if (!user || user.password !== password) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, {
          expiresIn: '1h',
        });
        res.cookie('token', token, { httpOnly: true, maxAge: 3600 * 1000 });
        // res.json({ token });
        res.redirect('/');
      } catch (err) {
        res.status(500).json({ error: 'Login error' });
      }
    });

    app.get('/', authenticateJWT, async (req, res) => {
      const notes = await Note.find({ userId: req.user.id });
      res.render('home', { notes });
    });

    app.post('/', authenticateJWT, async (req, res) => {
      const note = new Note({
        title: req.body.title,
        tags: req.body.tags,
        content: req.body.content,
        userId: req.user.id,
      });
      await note.save();
      res.redirect('/');
    });

    app.get('/notes/:id', async (req, res) => {
      const note = await Note.findById(req.params.id);
      if (!note) return res.send('Note not found');
      res.render('view', { note });
    });

    app.post('/notes/:id', async (req, res) => {
      const { title, content } = req.body;
      await Note.findByIdAndUpdate(req.params.id, { title, content });
      res.redirect('/');
    });

    app.post('/notes/:id/delete', async (req, res) => {
      await Note.findByIdAndDelete(req.params.id);
      res.redirect('/');
    });

    app.get('/login', (req, res) => {
      res.render('login');
    });

    app.get('/signup', (req, res) => {
      res.render('signup');
    });
    app.get('/logout', (req, res) => {
        res.clearCookie('token');
        res.redirect('/login');
    });
    app.listen(3000, () => {
      console.log('🚀 Server running at http://localhost:3000');
    });
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
  }
}

startApp();
