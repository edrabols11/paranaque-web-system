// models/ArchivedBook.js
const mongoose = require('mongoose');
//
const archivedBookSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  year: { 
    type: Number, 
    required: true,
    min: 1000,
    max: new Date().getFullYear() + 10
  },
  genre: { 
    type: String, 
    required: false,
    trim: true,
    default: 'Unknown'
  },
  author: { 
    type: String, 
    required: false,
    trim: true,
    default: 'Unknown Author'
  },
  publisher: { 
    type: String, 
    required: false,
    trim: true,
    default: 'Unknown Publisher'
  },
  category: { 
    type: String, 
    required: false,
    trim: true,
    default: 'Unknown Category'
  },
  accessionNumber: { 
    type: String, 
    required: false,
    default: null
  },
  callNumber: { 
    type: String, 
    required: false,
    default: null
  },
  location: { 
    type: Object, 
    required: false,
    default: null
  },
  status: { 
    type: String, 
    required: false,
    trim: true,
    default: 'Archived'
  },
  image: { 
    type: String, 
    default: null 
  },
  
  // Historical data from when it was active
  borrowedAt: { 
    type: Date, 
    default: null 
  },
  borrowedBy: { 
    type: String, 
    default: null,
    trim: true
  },
  dueDate: { 
    type: Date, 
    default: null 
  },
  reservedBy: { 
    type: String, 
    default: null,
    trim: true
  },
  reserveUntil: { 
    type: Date, 
    default: null 
  },
  reservedAt: { 
    type: Date, 
    default: null 
  },
  
  // Archive info
  archivedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

// Simple indexes
archivedBookSchema.index({ title: 1 });
archivedBookSchema.index({ genre: 1 });
archivedBookSchema.index({ archivedAt: -1 });

module.exports = mongoose.model('ArchivedBook', archivedBookSchema);