// routes/bookRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const Book = require('../models/Book');
const ArchivedBook = require('../models/ArchivedBook');
const Transaction = require('../models/Transaction');
const Log = require('../models/Log');
const ReservedBook = require('../models/ReservedBook');
const { uploadBase64ToSupabase, getFullImageUrl } = require('../utils/upload');

const router = express.Router();

// Function to get next accession number (using a simple sequential approach)
const getNextAccessionNumber = async () => {
  try {
    console.log("🔢 Starting accession number generation...");
    
    // Count total books to generate next sequence number
    const totalBooks = await Book.countDocuments({});
    console.log("📊 Total books in database:", totalBooks);
    
    const nextNumber = totalBooks + 1;
    console.log("📈 Next number calculated:", nextNumber);
    
    // Format as 6-digit zero-padded number (e.g., 000001, 000002, etc.)
    const formattedNumber = String(nextNumber).padStart(6, '0');
    console.log(`✅ Generated accession number: ${formattedNumber}`);
    
    return formattedNumber;
  } catch (err) {
    console.error('❌ Error in getNextAccessionNumber:', err.message);
    console.error('❌ Stack:', err.stack);
    
    // Fallback: use timestamp-based number if counting fails
    const fallback = String(Date.now()).slice(-6);
    console.log('⚠️  Using fallback accession number:', fallback);
    return fallback;
  }
};

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Add Book
// Accepts either multipart/form-data (with file) or JSON (with base64 image)
router.post('/', async (req, res) => {
  try {
    console.log("🔵 POST /api/books called");
    console.log("📝 Request body:", req.body);
    const { title, year, image, userEmail, location, author, publisher, callNumber, category, stock } = req.body;
    let imageField = null;

    // If image is a base64 string, store it directly
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      imageField = image;
    }

    // If using multipart/form-data, fallback to multer
    if (!imageField && req.file) {
      imageField = req.file.filename;
    }

    let imageUrl = null;

    // Upload profile image
    if (image) {
      try {
        imageUrl = await uploadBase64ToSupabase(
          image,
          "book_bucket",
          `book/${Date.now()}-${title}-book.jpg`
        );
        console.log("Book image uploaded to:", imageUrl);
      } catch (uploadErr) {
        console.error("Image upload failed:", uploadErr.message);
        // Continue without image
        imageUrl = null;
      }
    }

    // Auto-generate accession number
    console.log("📚 Generating accession number for:", title);
    const generatedAccessionNumber = await getNextAccessionNumber();
    console.log("📚 Generated accession number:", generatedAccessionNumber);

    const newBook = new Book({
      title,
      year,
      image: imageUrl,
      archived: false,
      borrowedAt: null,
      location,
      author,
      publisher,
      accessionNumber: generatedAccessionNumber,
      callNumber,
      category,
      stock: parseInt(stock) || 1,
      availableStock: parseInt(stock) || 1,
      status: 'available'
    });
    await newBook.save();
    console.log("✅ Book saved with accession number:", newBook.accessionNumber);

    // Log book addition
    await new Log({
      userEmail: userEmail || 'admin',
      action: `Added new book: ${title} (Accession: ${generatedAccessionNumber})`
    }).save();

    res.status(201).json({ message: 'Book added successfully!', book: newBook });
  } catch (err) {
    console.error("❌ Error adding book:", err);
    res.status(500).json({ error: 'Server error while adding book: ' + err.message });
  }
});

router.get("/", async (req, res) => {
  const { genre, status } = req.query;
  console.log("api/books - GET", genre, status);

  try {
    const now = new Date();

    // Auto-release expired reservations
    await Book.updateMany(
      { reserveUntil: { $lt: now } },
      {
        $set: {
          reservedBy: null,
          reservedAt: null,
          reserveUntil: null
        }
      }
    );

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = null;

    if (status === "Available") {
      console.log("Filtering for available books");
      filter = {
        $or: [
          { status: status },
          { status: null }
        ],
        ...(genre ? { category: { $regex: new RegExp(genre, "i") } } : {}),
      };

    } else if (status != null) {
      filter = {
        status: { $eq: status },
        ...(genre ? { category: { $regex: new RegExp(genre, "i") } } : {})
      };
    } else {
      filter = {
        ...(genre ? { category: { $regex: new RegExp(genre, "i") } } : {}),
      };
    }

    const totalBooks = await Book.countDocuments(filter);

    const books = await Book.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Ensure all books have stock and availableStock values
    const booksWithStock = await Promise.all(books.map(async (book) => {
      const bookObj = book.toObject();
      let needsUpdate = false;
      
      if (!bookObj.stock) {
        bookObj.stock = 1;
        book.stock = 1;
        needsUpdate = true;
      }
      if (bookObj.availableStock === undefined || bookObj.availableStock === null) {
        bookObj.availableStock = bookObj.stock;
        book.availableStock = bookObj.stock;
        needsUpdate = true;
      }
      
      // Add full image URL
      const imageUrl = getFullImageUrl(bookObj.image);
      bookObj.image = imageUrl;
      
      // Log image status for debugging
      if (!imageUrl) {
        console.warn(`⚠️  Book "${bookObj.title}" has no image URL`);
      }
      
      // Save to database if missing values were set
      if (needsUpdate) {
        await book.save();
      }
      
      return bookObj;
    }));

    console.log(`Returning ${books.length} books from page ${page}`);

    res.status(200).json({
      currentPage: page,
      totalPages: Math.ceil(totalBooks / limit),
      totalBooks,
      books: booksWithStock
    });

  } catch (err) {
    console.error("Error fetching books:", err);
    res.status(500).json({ error: "Error fetching books" });
  }
});


router.put('/archive/:id', async (req, res) => {
  console.log("PUT /archive/:id called with ID:", req.params.id, "Body:", req.body);

  try {
    const book = await Book.findById(req.params.id);
    console.log("📚 Book found:", book ? `${book.title} (${book._id})` : 'NOT FOUND');

    if (!book) {
      console.log("❌ Book not found with ID:", req.params.id);
      return res.status(404).json({ error: 'Book not found' });
    }

    // If archiving the book
    if (req.body.status === 'Archived') {
      console.log("🗂️  Archiving book:", book.title);
      // Create archived book record
      try {
        const archivedBook = new ArchivedBook({
          title: book.title || 'Unknown Title',
          year: book.year || new Date().getFullYear(),
          author: book.author || 'Unknown Author',
          publisher: book.publisher || 'Unknown Publisher',
          category: book.category || 'Unknown Category',
          genre: book.category || book.genre || 'Unknown', // Use category as fallback for genre
          image: book.image || null,
          accessionNumber: book.accessionNumber || null,
          callNumber: book.callNumber || null,
          location: book.location || null,
          status: 'Archived'
        });

        console.log("🗂️  Archived book object before save:", archivedBook);
        await archivedBook.save();
        console.log("✅ Archived book saved:", archivedBook._id);

        // Delete from regular books
        await Book.findByIdAndDelete(req.params.id);
        console.log("✅ Original book deleted from Books collection");

        res.status(200).json({
          message: 'Book archived successfully',
          book: archivedBook,
        });
      } catch (saveErr) {
        console.error("❌ Error saving archived book:", saveErr);
        console.error("❌ Validation errors:", saveErr.errors);
        res.status(500).json({ error: 'Error archiving book: Validation failed - ' + saveErr.message });
      }
    } else {
      // Regular status update
      book.status = req.body.status;
      await book.save();

      res.status(200).json({
        message: 'Book status updated successfully',
        updatedBook: book,
      });
    }

  } catch (err) {
    console.error("❌ Error archiving book:", err);
    console.error("❌ Error stack:", err.stack);
    res.status(500).json({ error: 'Error archiving book: ' + err.message });
  }
});


// Return book
router.put('/return/:id', async (req, res) => {
  console.log("PUT /return/:id", req.body);
  try {
    const { userEmail } = req.body;
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find only the transaction for this specific user
    const transaction = await Transaction.findOne({
      bookId: book._id,
      userEmail: userEmail,
      status: { $in: ['active', 'borrowed'] },
      type: 'borrow'
    });

    if (!transaction) {
      return res.status(404).json({ message: 'No active transaction found for this user and book' });
    }

    console.log(`Updating transaction ${transaction._id} for user ${userEmail}`);

    // Update only this transaction
    transaction.status = 'completed';
    transaction.returnDate = new Date();
    await transaction.save();

    // Log the action
    await new Log({
      userEmail: transaction.userEmail,
      action: `Returned book: ${book.title}`
    }).save();

    // Update book status - increment availableStock since it was borrowed
    book.availableStock = (book.availableStock || 0) + 1;
    console.log(`Incrementing stock for book from ${(book.availableStock || 0) - 1} to ${book.availableStock}`);
    
    // Only clear borrowedBy if there are no more active transactions for this book
    const remainingTransactions = await Transaction.findOne({
      bookId: book._id,
      status: { $in: ['active', 'borrowed'] },
      type: 'borrow'
    });

    if (!remainingTransactions) {
      book.borrowedBy = null;
      book.borrowedAt = null;
    }
    
    await book.save();

    console.log(`Return successful for book ${book._id} by user ${userEmail}`);
    res.json({
      message: 'Book returned successfully',
      book,
      transaction
    });
  } catch (err) {
    console.error('Error returning book:', err);
    res.status(500).json({ message: err.message });
  }
});

// 🔧 FIXED: Unarchive book (return archived book to stocks)
router.put('/archived/return/:id', async (req, res) => {
  try {
    const archivedBook = await ArchivedBook.findById(req.params.id);
    if (!archivedBook) return res.status(404).json({ error: 'Archived book not found' });

    // Create new book in main collection with all archived data
    const book = new Book({
      title: archivedBook.title,
      year: archivedBook.year,
      author: archivedBook.author,
      publisher: archivedBook.publisher,
      category: archivedBook.category,
      accessionNumber: archivedBook.accessionNumber,
      callNumber: archivedBook.callNumber,
      location: archivedBook.location,
      image: archivedBook.image,
      archived: false,
      borrowedAt: null,
      borrowedBy: null,
      dueDate: null,
      reservedBy: null,
      reservedAt: null,
      reserveUntil: null,
      status: 'Available',
      stock: 1,
      availableStock: 1
    });

    await book.save();
    await ArchivedBook.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Book returned to stocks!', book });
  } catch (err) {
    console.error("Error unarchiving book:", err);
    res.status(500).json({ error: 'Error returning book to stock' });
  }
});

// Mark book as borrowed
router.put('/borrow/:id', async (req, res) => {
  try {
    const { userEmail } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if there are available copies
    const availableStock = book.availableStock || book.stock || 0;
    if (availableStock <= 0) {
      return res.status(400).json({ message: 'Book is not available' });
    }

    // Create a new transaction
    const transaction = new Transaction({
      bookId: book._id,
      userEmail,
      type: 'borrow',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      bookTitle: book.title
    });

    // Update book status - decrement available stock
    book.borrowedBy = userEmail;
    book.borrowedAt = new Date();
    book.availableStock = (book.availableStock || book.stock || 0) - 1;

    await Promise.all([
      transaction.save(),
      book.save(),
      new Log({
        userEmail,
        action: `Borrowed book: ${book.title}`
      }).save()
    ]);

    res.json({ message: 'Book borrowed successfully', book, transaction });
  } catch (err) {
    console.error('Error borrowing book:', err);
    res.status(500).json({ message: err.message });
  }
});

// Reserve a book
router.post('/reserve/:id', async (req, res) => {
  try {
    const { userEmail } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if book is already reserved
    const existingReservation = await Transaction.findOne({
      bookId: book._id,
      type: 'reserve',
      status: 'active'
    });

    if (existingReservation) {
      return res.status(400).json({ message: 'Book is already reserved' });
    }

    // Create a new transaction
    const transaction = new Transaction({
      bookId: book._id,
      userEmail,
      type: 'reserve',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days reservation
      bookTitle: book.title
    });

    // Also create ReservedBook entry and log errors if any
    await Promise.all([
      transaction.save(),
      new Log({
        userEmail,
        action: `Reserved book: ${book.title}`
      }).save(),
      (async () => {
        try {
          await ReservedBook.create({
            bookId: book._id,
            userEmail,
            bookTitle: book.title,
            reservedAt: new Date(),
            transactionId: transaction._id
          });
        } catch (err) {
          console.error('Error creating ReservedBook:', err);
        }
      })()
    ]);

    res.json({ message: 'Book reserved successfully', transaction });
  } catch (err) {
    console.error('Error reserving book:', err);
    res.status(500).json({ message: err.message });
  }
});

// Cancel a reservation
router.put('/cancel-reservation/:id', async (req, res) => {
  try {
    const { userEmail } = req.body;
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find the active reservation for this book and user
    const reservation = await Transaction.findOne({
      bookId: book._id,
      userEmail,
      type: 'reserve',
      status: 'active'
    });

    if (!reservation) {
      return res.status(404).json({ message: 'No active reservation found for this book' });
    }

    // Update reservation status
    reservation.status = 'cancelled';
    reservation.returnDate = new Date();
    await reservation.save();

    // Log the cancellation
    await new Log({
      userEmail,
      action: `Cancelled reservation for book: ${book.title}`
    }).save();

    res.json({
      message: 'Reservation cancelled successfully',
      book
    });
  } catch (err) {
    console.error('Error cancelling reservation:', err);
    res.status(500).json({ message: err.message });
  }
});

// Stats: Books added today
router.get('/stats/today', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayCount = await Book.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    res.status(200).json({ todayCount });
  } catch (err) {
    console.error("Error getting today's count:", err);
    res.status(500).json({ error: 'Server error while counting books added today' });
  }
});

// Stats: Books borrowed in last 7 days
router.get('/stats/borrowed-week', async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const borrowedWeekCount = await Transaction.countDocuments({
      type: 'borrow',
      status: { $in: ['active', 'completed'] },
      startDate: { $gte: sevenDaysAgo }
    });

    const weekTransactions = await Transaction.find({
      type: 'borrow',
      status: { $in: ['active', 'completed'] },
      startDate: { $gte: sevenDaysAgo }
    }).populate('bookId').sort({ startDate: -1 });

    const books = weekTransactions
      .filter(t => t.bookId) // Filter out transactions with null bookId
      .map(t => ({
        _id: t.bookId._id,
        title: t.bookId.title,
        author: t.bookId.author,
        category: t.bookId.category,
        image: t.bookId.image,
        borrowedBy: t.userEmail,
        borrowedAt: t.startDate,
        dueDate: t.endDate
      }));

    res.status(200).json({ borrowedWeekCount, books });
  } catch (err) {
    console.error("Error getting borrowed books count for the week:", err);
    res.status(500).json({ error: 'Server error while counting borrowed books this week' });
  }
});

// Stats: Books borrowed today
router.get('/stats/borrowed-today', async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayTransactions = await Transaction.find({
      type: 'borrow',
      status: { $in: ['active', 'completed'] },
      startDate: { $gte: startOfDay, $lte: endOfDay }
    }).populate('bookId').sort({ startDate: -1 });

    const books = todayTransactions
      .filter(t => t.bookId) // Filter out transactions with null bookId
      .map(t => ({
        _id: t.bookId._id,
        title: t.bookId.title,
        author: t.bookId.author,
        category: t.bookId.category,
        image: t.bookId.image,
        borrowedBy: t.userEmail,
        borrowedAt: t.startDate,
        dueDate: t.endDate
      }));

    res.status(200).json({ books, count: books.length });
  } catch (err) {
    console.error("Error getting borrowed books for today:", err);
    res.status(500).json({ error: 'Server error while fetching today borrowed books' });
  }
});

// Stats: Books borrowed in last 30 days
router.get('/stats/borrowed-month', async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthTransactions = await Transaction.find({
      type: 'borrow',
      status: { $in: ['active', 'completed'] },
      startDate: { $gte: thirtyDaysAgo }
    }).populate('bookId').sort({ startDate: -1 });

    const books = monthTransactions
      .filter(t => t.bookId) // Filter out transactions with null bookId
      .map(t => ({
        _id: t.bookId._id,
        title: t.bookId.title,
        author: t.bookId.author,
        category: t.bookId.category,
        image: t.bookId.image,
        borrowedBy: t.userEmail,
        borrowedAt: t.startDate,
        dueDate: t.endDate
      }));

    res.status(200).json({ books, count: books.length });
  } catch (err) {
    console.error("Error getting borrowed books for the month:", err);
    res.status(500).json({ error: 'Server error while fetching month borrowed books' });
  }
});

// Stats: Most borrowed books (all time)
router.get('/stats/most-borrowed', async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    
    // Aggregate transactions to count borrows per book
    const mostBorrowedBooks = await Transaction.aggregate([
      {
        $match: { type: 'borrow' } // Only count borrow transactions
      },
      {
        $group: {
          _id: '$bookId',
          borrowCount: { $sum: 1 },
          bookTitle: { $first: '$bookTitle' }
        }
      },
      {
        $sort: { borrowCount: -1 }
      },
      {
        $limit: 10 // Top 10 most borrowed
      },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'bookDetails'
        }
      },
      {
        $unwind: {
          path: '$bookDetails',
          preserveNullAndEmptyArrays: true
        }
      }
    ]);

    // Format the response
    const formattedBooks = mostBorrowedBooks.map(item => ({
      _id: item._id,
      title: item.bookDetails?.title || item.bookTitle,
      author: item.bookDetails?.author || 'Unknown',
      category: item.bookDetails?.category || 'Unknown',
      image: item.bookDetails?.image || null,
      borrowCount: item.borrowCount,
      year: item.bookDetails?.year,
      stock: item.bookDetails?.stock,
      availableStock: item.bookDetails?.availableStock
    }));

    res.status(200).json({ 
      mostBorrowedBooks: formattedBooks,
      totalBooks: formattedBooks.length
    });
  } catch (err) {
    console.error("Error getting most borrowed books:", err);
    res.status(500).json({ error: 'Server error while fetching most borrowed books' });
  }
});

// 🔧 FIXED: Delete a book permanently (checks both collections)
router.delete('/:id', async (req, res) => {
  try {
    // Try to delete from regular books first
    let deletedBook = await Book.findByIdAndDelete(req.params.id);

    // If not found in regular books, try archived books
    if (!deletedBook) {
      deletedBook = await ArchivedBook.findByIdAndDelete(req.params.id);
    }

    if (!deletedBook) {
      return res.status(404).json({ error: 'Book not found in any collection' });
    }

    res.status(200).json({ message: 'Book deleted successfully', book: deletedBook });
  } catch (err) {
    console.error("Error deleting book:", err);
    res.status(500).json({ error: 'Error deleting book' });
  }
});

// Get all borrowed books
router.get('/borrowed', async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    // Get only ACTIVE/BORROWED borrow transactions
    const borrowedTransactions = await Transaction.find({
      type: 'borrow',
      status: { $in: ['active', 'borrowed'] }
    }).populate('bookId');

    console.log(`Found ${borrowedTransactions.length} active borrow transactions`);
    borrowedTransactions.forEach((t, idx) => {
      console.log(`Transaction ${idx}: status=${t.status}, userEmail=${t.userEmail}, bookId=${t.bookId?._id}`);
    });

    // Show only active/borrowed borrow transactions
    const books = borrowedTransactions
      .filter(t => t.bookId) // Only include if bookId populated successfully
      .map(t => ({
        _id: t.bookId._id,
        title: t.bookId.title,
        author: t.bookId.author,
        category: t.bookId.category,
        image: t.bookId.image,
        borrowedBy: t.userEmail,
        borrowedAt: t.startDate,
        dueDate: t.endDate,
        status: t.status
      }));

    console.log(`Returning ${books.length} books`);
    res.status(200).json({ books });
  } catch (err) {
    console.error("Error fetching borrowed books:", err);
    res.status(500).json({ error: "Error fetching borrowed books" });
  }
});

// Get all archived books
router.get('/archived/all', async (req, res) => {
  try {
    const archivedBooks = await ArchivedBook.find();
    res.status(200).json({ books: archivedBooks });
  } catch (err) {
    console.error("Error fetching archived books:", err);
    res.status(500).json({ error: "Error fetching archived books" });
  }
});

// Get all reserved books
router.get('/reserved', async (req, res) => {
  try {
    const reservedBooks = await Book.find({ reservedBy: { $ne: null } });
    res.status(200).json({ books: reservedBooks });
  } catch (err) {
    console.error("Error fetching reserved books:", err);
    res.status(500).json({ error: "Error fetching reserved books" });
  }
});

// Update book details
router.put('/update/:id', upload.single('image'), async (req, res) => {
  try {
    const { title, year, genre } = req.body;

    const updateData = {
      title,
      year,
      genre
    };

    // Only update image if a new one is uploaded
    if (req.file) {
      updateData.image = req.file.filename;
    }

    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedBook) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.status(200).json({ message: 'Book updated successfully', book: updatedBook });
  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).json({ error: 'Error updating book' });
  }
});

// Borrow a reserved book
router.put('/borrow-reserved/:id', async (req, res) => {
  try {
    const { userEmail, reservationId } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Verify the reservation
    const reservation = await Transaction.findOne({
      _id: reservationId,
      bookId: book._id,
      userEmail,
      type: 'reserve',
      status: 'active'
    });

    if (!reservation) {
      return res.status(404).json({ message: 'Active reservation not found' });
    }

    // Check if it's the reserved date
    const today = new Date();
    const reserveDate = new Date(reservation.startDate);
    if (today.toDateString() !== reserveDate.toDateString()) {
      return res.status(400).json({
        message: 'This book can only be borrowed on the reserved date'
      });
    }

    // Mark the reservation as completed
    reservation.status = 'completed';
    await reservation.save();

    // Create new borrow transaction
    const borrowTransaction = new Transaction({
      bookId: book._id,
      userEmail,
      type: 'borrow',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      bookTitle: book.title
    });

    // Update book status
    book.borrowedBy = userEmail;
    book.borrowedAt = new Date();

    await Promise.all([
      borrowTransaction.save(),
      book.save(),
      new Log({
        userEmail,
        action: `Borrowed reserved book: ${book.title}`
      }).save()
    ]);

    res.json({
      message: 'Reserved book borrowed successfully',
      book,
      transaction: borrowTransaction
    });
  } catch (err) {
    console.error('Error borrowing reserved book:', err);
    res.status(500).json({ message: err.message });
  }
});

// Cleanup: Return books from deleted users
router.post('/cleanup/return-deleted-users', async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Find all active borrow transactions
    const activeTransactions = await Transaction.find({
      type: 'borrow',
      status: 'active'
    });

    console.log(`Found ${activeTransactions.length} active borrow transactions`);

    let returnedCount = 0;
    let skippedCount = 0;

    // Check each transaction's user
    for (const transaction of activeTransactions) {
      const userExists = await User.findOne({ email: transaction.userEmail });
      
      if (!userExists) {
        // User has been deleted, return the book
        console.log(`User ${transaction.userEmail} not found, returning book ${transaction.bookId}`);
        
        const book = await Book.findById(transaction.bookId);
        if (book) {
          // Increment availableStock since it was borrowed
          book.availableStock = (book.availableStock || 0) + 1;
          book.borrowedBy = null;
          book.borrowedAt = null;
          await book.save();
        }

        // Mark transaction as completed
        transaction.status = 'completed';
        transaction.returnDate = new Date();
        await transaction.save();

        // Log the action
        await new Log({
          userEmail: 'system',
          action: `Auto-returned book from deleted user: ${transaction.bookTitle} (was borrowed by ${transaction.userEmail})`
        }).save();

        returnedCount++;
      } else {
        skippedCount++;
      }
    }

    res.json({
      message: `Cleanup completed. Returned ${returnedCount} books from deleted users.`,
      returnedCount,
      skippedCount
    });
  } catch (err) {
    console.error('Error in cleanup:', err);
    res.status(500).json({ message: err.message });
  }
});

// Diagnostic endpoint to check image URLs
router.get('/diagnostic/images', async (req, res) => {
  try {
    const books = await Book.find({ archived: false }).limit(5).select('title image category');
    
    const diagnostics = books.map(book => ({
      title: book.title,
      category: book.category,
      imageField: book.image,
      imageUrl: getFullImageUrl(book.image),
      isValid: book.image ? true : false
    }));
    
    res.json({
      message: 'Image URL Diagnostics',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      books: diagnostics
    });
  } catch (err) {
    console.error('Diagnostic error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint to fix accession numbers for existing books
router.post('/admin/fix-accession-numbers', async (req, res) => {
  try {
    // Get all books, sorted by creation date
    const books = await Book.find({}).sort({ createdAt: 1 });
    
    console.log(`📚 Fixing accession numbers for ${books.length} books`);
    
    let counter = 0;
    const updatePromises = [];
    
    for (const book of books) {
      counter++;
      const newAccessionNumber = String(counter).padStart(6, '0');
      updatePromises.push(
        Book.findByIdAndUpdate(book._id, { accessionNumber: newAccessionNumber })
      );
    }
    
    await Promise.all(updatePromises);
    
    console.log("✅ Fixed accession numbers for", counter, "books");
    
    res.json({
      message: 'Accession numbers fixed successfully',
      booksFixed: counter
    });
  } catch (err) {
    console.error('❌ Error fixing accession numbers:', err);
    res.status(500).json({ error: 'Failed to fix accession numbers: ' + err.message });
  }
});

module.exports = router;
