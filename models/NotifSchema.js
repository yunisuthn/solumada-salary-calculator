const mongoose = require('mongoose');

const NotifSchema = mongoose.Schema({
    category: {
        type: String,
        default: 'none'
    },
    description: {
        type: String,
        default: 'none'
    },
    seen: {
        type: Boolean,
        default: false
    },
    creation: {
        type: Date,
        default: new Date()
    },
    link: {
        type: String,
        default: "#"
    },
    user: {
        type: String,
        default: ""
    }
})

module.exports = mongoose.model('notifschema', NotifSchema);