const mongoose = require('mongoose');

const SubtopicSchema = new mongoose.Schema({
  subTitle: {
    type: String,
    required: true,
    trim: true,
  },
  activity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity',
    required: true,
  },
  content: {
    type: String,
  },
  mediaType: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  pdfUrls: 
  {
      type: [String],
  },
  order: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Subtopic', SubtopicSchema);