const express = require('express');
const cors = require('cors');
const fs = require('fs');

const USERS_PATH = './users.json';
const FEEDBACKS_PATH = './feedbacks.json';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Load users
let users = {};
if (fs.existsSync(USERS_PATH)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
  } catch (err) {
    console.error('Error reading users.json:', err);
  }
}

// Load feedbacks
let feedbacks = [];
if (fs.existsSync(FEEDBACKS_PATH)) {
  try {
    feedbacks = JSON.parse(fs.readFileSync(FEEDBACKS_PATH, 'utf-8'));
  } catch (err) {
    console.error('Error reading feedbacks.json:', err);
  }
}

function saveUsers() {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

function saveFeedbacks() {
  fs.writeFileSync(FEEDBACKS_PATH, JSON.stringify(feedbacks, null, 2));
}

// Signup
app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: 'Username, email, and password are required.' });

  if (users[email]) return res.status(400).json({ message: 'User already exists.' });

  users[email] = {
    username,
    password,
    earnings: 0,
    screenTime: 0,
    withdrawRequests: [],
  };
  saveUsers();
  res.status(200).json({ success: true, message: 'Signup successful!' });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user || user.password !== password)
    return res.status(401).json({ message: 'Invalid credentials.' });

  user.lastLogin = new Date().toISOString();
  saveUsers();

  res.status(200).json({ success: true, message: 'Login successful!', username: user.username, lastLogin: user.lastLogin });
});

// Add earnings
app.post('/activity', (req, res) => {
  const { email, earningsEarned } = req.body;
  if (!users[email]) return res.status(404).json({ message: 'User not found.' });

  const earnings = Number(earningsEarned);
  if (isNaN(earnings) || earnings < 0)
    return res.status(400).json({ message: 'Invalid earnings value.' });

  users[email].earnings += earnings;
  saveUsers();

  res.status(200).json({ message: 'Earnings updated!', totalEarnings: users[email].earnings });
});

// Update screen time
app.post('/screentime', (req, res) => {
  const { email, timeSpent } = req.body;
  if (!users[email]) return res.status(404).json({ message: 'User not found.' });

  const time = Number(timeSpent);
  if (isNaN(time) || time < 0)
    return res.status(400).json({ message: 'Invalid time value.' });

  users[email].screenTime += time;
  saveUsers();

  res.status(200).json({ message: 'Screen time updated!', totalScreenTime: users[email].screenTime });
});

// Submit feedback
app.post('/submit-feedback', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ message: 'Name, email, and message are required.' });

  feedbacks.push({
    name,
    email,
    message,
    date: new Date().toISOString(),
  });
  saveFeedbacks();

  res.status(200).json({ message: 'Feedback submitted. Thank you!' });
});

// Admin: get all feedbacks
app.get('/admin/feedbacks', (req, res) => {
  res.status(200).json(feedbacks);
});

// Withdrawal request
app.post('/withdraw', (req, res) => {
  const { email, amount, method } = req.body;
  if (!users[email]) return res.status(404).json({ message: 'User not found.' });

  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0 || amt > users[email].earnings)
    return res.status(400).json({ message: 'Invalid withdrawal amount.' });

  const request = {
    amount: amt,
    method,
    date: new Date().toISOString(),
    approved: false,
  };

  users[email].earnings -= amt;
  users[email].withdrawRequests.push(request);
  saveUsers();

  res.status(200).json({ message: 'Withdrawal request submitted!' });
});

// Cancel withdrawal request
app.post('/user/withdraw/cancel', (req, res) => {
  const { email, date } = req.body;
  if (!users[email]) return res.status(404).json({ message: 'User not found.' });

  const index = users[email].withdrawRequests.findIndex(r => r.date === date && !r.approved);
  if (index === -1) return res.status(404).json({ message: 'Pending request not found.' });

  const [removed] = users[email].withdrawRequests.splice(index, 1);
  users[email].earnings += removed.amount;
  saveUsers();

  res.status(200).json({ message: 'Withdrawal request cancelled.' });
});

// Admin: get all withdrawal requests
app.get('/admin/withdrawals', (req, res) => {
  const allRequests = [];
  for (const email in users) {
    const user = users[email];
    if (Array.isArray(user.withdrawRequests)) {
      user.withdrawRequests.forEach(req => {
        allRequests.push({
          email,
          username: user.username,
          amount: req.amount,
          method: req.method,
          date: req.date,
          status: req.approved ? 'approved' : 'pending',
          approved: req.approved,
        });
      });
    }
  }
  res.status(200).json(allRequests);
});

// Admin: approve withdrawal
app.post('/admin/approve', (req, res) => {
  const { email, date } = req.body;
  if (!users[email]) return res.status(404).json({ message: 'User not found.' });

  const request = users[email].withdrawRequests.find(r => r.date === date);
  if (!request) return res.status(404).json({ message: 'Request not found.' });

  if (request.approved) return res.status(400).json({ message: 'Request already approved.' });

  request.approved = true;
  saveUsers();

  res.status(200).json({ message: 'Withdrawal approved.' });
});

// Get user's withdrawal requests
app.get('/user/:email/withdrawals', (req, res) => {
  const { email } = req.params;
  if (!users[email]) return res.status(404).json({ message: 'User not found.' });

  res.status(200).json(users[email].withdrawRequests || []);
});

// Get user info
app.get('/user/:email', (req, res) => {
  const { email } = req.params;
  if (!users[email]) return res.status(404).json({ message: 'User not found.' });

  const { username, earnings, screenTime, withdrawRequests, lastLogin } = users[email];
  res.status(200).json({ email, username, earnings, screenTime, withdrawRequests, lastLogin });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
