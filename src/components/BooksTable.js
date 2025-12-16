import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import './App.css';
import AddBook from '../pages/AddBook';

const BooksTable = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddBookModal, setShowAddBookModal] = useState(false);

  useEffect(() => {
    fetchReservedBooks();
  }, []);

  const fetchReservedBooks = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://paranaledge-y7z1.onrender.com/api/books/?limit=10000');
      const data = await response.json();
      if (response.ok) {
        setBooks(data.books || []);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch reserved books');
      }
    } catch (err) {
      setError('Error connecting to server. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = filteredBooks.map(book => ({
      'Book Title': book.title,
      'Author': book.author,
      'Year': book.year,
      'Category': book.category,
      'Accession Number': book.accessionNumber,
      'Call Number': book.callNumber,
      'Stock': book.stock,
      'Available Stock': book.availableStock,
      'Location': book.location ? `${book.location.genreCode}-${book.location.shelf}-${book.location.level}` : 'N/A',
      'Status': book.status || 'Available'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Books");
    XLSX.writeFile(wb, `Books_Report_${new Date().toLocaleDateString()}.xlsx`);
  };


  if (loading) {
    return <div className="pending-container"><h2>Books</h2><p>Loading books...</p></div>;
  }

  const filteredBooks = books.filter(
    (book) =>
      (book.title?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (book.author?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (book.accessionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  );

  const archiveBook = async (bookId) => {
    if (window.confirm("Are you sure you want to archive this book?")) {
      try {
        const res = await fetch(`https://paranaledge-y7z1.onrender.com/api/books/archive/${bookId}`, {
          method: 'PUT',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Archived" }),
        });
        const data = await res.json();
        if (res.ok) {
          alert("Book archived successfully!");
          const updatedList = books.filter((book) => book._id !== bookId);
          setBooks(updatedList);
        } else {
          console.error(data.error);
          alert(data.error || "Failed to archive book");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="pending-container">
      <div className="header-row">
        <h2 className="page-title">📗 Books</h2>

        <div className="search-container ">
          <input type="text" placeholder="Search analytics..." onChange={(e) => setSearchTerm(e.target.value)} />
          <button onClick={() => setShowAddBookModal(true)} className="um-btn um-edit" style={{ paddingTop: "10px", paddingBottom: "10px" }} >
            Add Books
          </button>
          <button onClick={exportToExcel} className="um-btn um-edit" style={{ paddingTop: "10px", paddingBottom: "10px" }} title="Export to Excel">
            📥 Export
          </button>
          <button onClick={fetchReservedBooks} className="um-btn um-edit" style={{ paddingTop: "10px", paddingBottom: "10px" }} title="Refresh">
            🔄 Refresh
          </button>
        </div>

      </div>
      {error && <div className="error-message">{error}</div>}
      {!error && books.length === 0 ? (
        <div className="empty-state">
          <img src="/imgs/empty.png" alt="No Data" className="empty-img" />
          <p>No reserved books found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Book Title</th>
                <th>Year</th>
                <th>Category</th>
                <th>Author</th>
                <th>Accession Number</th>
                <th>Call Number</th>
                <th>Stock</th>
                <th>Available Stock</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map((book) => (
                <tr key={book._id}>
                  <td>
                    {book.image && (
                      <img
                        src={book.image ? book.image : ""}
                        alt={book.title}
                        style={{ width: "60px", height: "80px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ddd" }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </td>
                  <td>{book.title}</td>
                  <td>{book.year}</td>
                  <td>{book.category}</td>
                  <td>{book.author}</td>
                  <td>{book.accessionNumber}</td>
                  <td>{book.callNumber}</td>
                  <td>{book.stock || '-'}</td>
                  <td>{book.availableStock !== undefined ? book.availableStock : book.stock || '-'}</td>
                  <td>
                    {book.location
                      ? `${book.location.genreCode}-${book.location.shelf}-${book.location.level}`
                      : "N/A"}
                  </td>
                  <td>
                    {book.status ? book.status : "Available"}
                  </td>
                  <td>
                    <button onClick={() => archiveBook(book._id)} className="um-btn um-edit" style={{ paddingTop: "10px", paddingBottom: "10px", backgroundColor: '#dab43bff' }}>Archive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add Book Modal */}
          {showAddBookModal && (
            <div className="modal-overlay" onClick={() => setShowAddBookModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '95%', height: '90%', padding: '10px', background: '#fff', borderRadius: '10px', position: 'relative' }}>
                <button
                  onClick={() => setShowAddBookModal(false)}
                  style={{ position: 'absolute', top: 10, right: 16, background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                  aria-label="Close"
                >
                  ×
                </button>
                <AddBook onBookAdded={() => { setShowAddBookModal(false); }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BooksTable;
