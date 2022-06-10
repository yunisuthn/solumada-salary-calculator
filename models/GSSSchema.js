const mongoose = require('mongoose');

const GSSSchema = mongoose.Schema({
    salary: {
        type: String,
        default: ''
    },
    column: {
        type: String,
        default: ''
    }
})

module.exports = mongoose.model('gss', GSSSchema);