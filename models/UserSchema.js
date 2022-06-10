const mongoose = require('mongoose');

const User = mongoose.Schema({
    username: String,
    email: String,
    access: Boolean,
    password: String,
    creation: {
        type: Date,
        default: new Date()
    },
    usertype: {
        type: String,
        default: 'guest'
    }
})

module.exports = mongoose.model('user', User);