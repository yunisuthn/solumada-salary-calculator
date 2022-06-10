const mongoose = require('mongoose');

const SCSchema = mongoose.Schema({
    name: String,
    number: {
        type: Number,
        default: 0
    },
    creation: {
        type: Date,
        default: new Date()
    }
})

module.exports = mongoose.model('scschema', SCSchema);