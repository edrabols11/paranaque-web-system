const mongoose = require('mongoose');
require('dotenv').config();

const Counter = require('./backend/models/Counter');
const Book = require('./backend/models/Book');

async function testAccession() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check Counter model
    console.log('\n📊 Checking Counter collection...');
    const counter = await Counter.findOne({ name: 'accessionNumber' });
    console.log('Current counter:', counter);

    // Check recent books
    console.log('\n📚 Checking recent books...');
    const recentBooks = await Book.find({}).sort({ createdAt: -1 }).limit(5);
    console.log('Recent books:');
    recentBooks.forEach(book => {
      console.log(`  - ${book.title}: ${book.accessionNumber}`);
    });

    // Simulate adding a new book
    console.log('\n🔢 Testing accession number generation...');
    
    // Get or create counter
    let count = await Counter.findOne({ name: 'accessionNumber' });
    if (!count) {
      console.log('Creating new counter...');
      count = new Counter({ name: 'accessionNumber', value: 0 });
      await count.save();
    }

    count.value += 1;
    await count.save();
    
    const currentYear = new Date().getFullYear();
    const sequenceNumber = String(count.value).padStart(4, '0');
    const accessionNumber = `${currentYear}-${sequenceNumber}`;
    
    console.log(`Generated: ${accessionNumber}`);
    console.log('✅ Test successful!');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testAccession();
