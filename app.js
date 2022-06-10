require('dotenv').config();
const EventEmitter = require('events');
const emitter = new EventEmitter();
emitter.setMaxListeners(0);
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const expressUpload = require('express-fileupload');
const router = require('./controllers/controller');
const app = express();
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 8086;
const session = require('cookie-session');

// static files 
app.use(express.static('public'));
app.use(express.static('uploads'));
app.use(express.static('template'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use(express.static(__dirname))
app.use(session({
  name: 'sid',
  resave: true,
  saveUninitialized: true,
  secret: 'psc',
  cookie: {
    expires: new Date(Date.now() + 360000 * 24),
    maxAge: Date.now() + 360000 * 24
  }
}));
// use upload
app.use(expressUpload());

// set template enginea
app.use(expressLayouts)
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").createServer(app);
const io = require("socket.io")(server);
io.on('connection', socket => {
  app.set("socket", socket);
});
app.set('io', io)

app.use('/', router);
app.use("*", (req, res) => {
  res.render('404', {login: true});
});

server.listen(PORT, () => {
  const port = server.address().port;
  console.log(`Express is working on port ${port}`);
});
