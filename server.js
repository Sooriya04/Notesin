const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
require("dotenv").config();

const { db } = require("./firebase");
const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware
function authenticateJWT(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("Invalid token");
    req.user = user;
    next();
  });
}

// Routes
app.get("/signup", (req, res) => res.render("signup"));
app.get("/login", (req, res) => res.render("login"));
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// Signup
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const userRef = db.collection("users").doc(email);

  try {
    const doc = await userRef.get();
    if (doc.exists) return res.status(400).send("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    await userRef.set({ email, password: hashedPassword });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, { httpOnly: true, maxAge: 3600 * 1000 });
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(400).send("Registration failed");
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const userRef = db.collection("users").doc(email);

  try {
    const doc = await userRef.get();
    if (!doc.exists) return res.status(401).send("Invalid credentials");

    const user = doc.data();
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send("Invalid credentials");

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, { httpOnly: true, maxAge: 3600 * 1000 });
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Login error");
  }
});

// Home - List notes for user
app.get("/", authenticateJWT, async (req, res) => {
  const notesSnapshot = await db
    .collection("notes")
    .where("userId", "==", req.user.email)
    .get();

  const notes = [];
  notesSnapshot.forEach((doc) => {
    notes.push({ id: doc.id, ...doc.data() });
  });

  res.render("home", { notes });
});

// Create note
app.post("/", authenticateJWT, async (req, res) => {
  const { title, tags, content } = req.body;
  await db.collection("notes").add({
    title,
    tags,
    content,
    userId: req.user.email,
  });

  res.redirect("/");
});

// View note
app.get("/notes/:id", authenticateJWT, async (req, res) => {
  const doc = await db.collection("notes").doc(req.params.id).get();
  if (!doc.exists) return res.send("Note not found");

  const note = doc.data();
  res.render("view", { note, id: req.params.id });
});

// Update note
app.post("/notes/:id", authenticateJWT, async (req, res) => {
  const { title, content } = req.body;
  await db.collection("notes").doc(req.params.id).update({ title, content });
  res.redirect("/");
});

// Delete note
app.post("/notes/:id/delete", authenticateJWT, async (req, res) => {
  await db.collection("notes").doc(req.params.id).delete();
  res.redirect("/");
});

// Start
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
