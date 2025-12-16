// src/pages/ArchivedBooks.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../components/App.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faUndo, faTrash, faBook } from "@fortawesome/free-solid-svg-icons";
import logo from "../imgs/liblogo.png";

const ArchivedBooks = () => {
  const [archivedBooks, setArchivedBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchArchivedBooks = async () => {
      try {
        const res = await fetch('http://localhost:5050/api/books?status=Archived');
        const data = await res.json();
        if (res.ok) {
          setArchivedBooks(data.books);
          setFilteredBooks(data.books);
        } else {
          setError(data.error || "Failed to fetch archived books.");
        }
      } catch (err) {
        setError("Error fetching archived books.");
        console.error(err);
      }
    };

    fetchArchivedBooks();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBooks(archivedBooks);
    } else {
      const lowercasedQuery = searchQuery.toLowerCase();
      setFilteredBooks(
        archivedBooks.filter((book) =>
          book.title?.toLowerCase().includes(lowercasedQuery) || false
        )
      );
    }
  }, [searchQuery, archivedBooks]);

  const handleDelete = async (bookId) => {
    if (window.confirm("Are you sure you want to permanently delete this book?")) {
      try {
        const res = await fetch(`http://localhost:5050/api/books/${bookId}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          const updatedList = archivedBooks.filter((book) => book._id !== bookId);
          setArchivedBooks(updatedList);
          setFilteredBooks(updatedList);
          alert("Book deleted successfully!");
        } else {
          alert(data.error || "Failed to delete book.");
        }
      } catch (err) {
        alert("Error deleting book.");
        console.error(err);
      }
    }
  };

  const handleReturnToStocks = async (bookId) => {
    if (window.confirm("Are you sure you want to return this book to stocks?")) {
      try {
        const res = await fetch(`http://localhost:5050/api/books/archive/${bookId}`, {
          method: 'PUT',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Available" }),
        });
        const data = await res.json();
        if (res.ok) {
          const updatedList = archivedBooks.filter((book) => book._id !== bookId);
          setArchivedBooks(updatedList);
          setFilteredBooks(updatedList);
          alert("Book returned to stocks successfully!");
        } else {
          alert(data.error || "Failed to return book to stocks.");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="logo2">
          <img style={{ width: '50px' }} src={logo} alt="School" />
        </div>
        <nav className="nav-links">
          <button onClick={() => navigate("/admin-dashboard", { state: { openResource: true } })}>
            <FontAwesomeIcon icon={faArrowLeft} />
            <span style={{ marginLeft: 8 }}>Back to Dashboard</span>
          </button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search archived books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FontAwesomeIcon icon={faBook} />
          </div>
        </header>

        <section className="content">
          <h2 style={{ fontWeight: '600', fontSize: '25px', marginTop: "-5px", marginBottom: '-5px' }}>Archived Books</h2>
          <p className="archive-info">
            Total Archived Books: <strong>{archivedBooks.length}</strong>
          </p>

          {error && <div className="error-message">{error}</div>}

          {filteredBooks.length === 0 ? (
            <div className="no-books-message">
              {searchQuery ?
                `No archived books found matching "${searchQuery}".` :
                "No archived books found."
              }
            </div>
          ) : (
            <div className="table-container">
              <table className="book-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Year</th>
                    <th>Category</th>
                    <th>Image</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((book) => (
                    <tr key={book._id}>
                      <td>{book.title}</td>
                      <td>{book.year}</td>
                      <td>{book.category || 'N/A'}</td>
                      <td>
                        {book.image ? (
                          <img
                            src={book.image ? book.image : ""}
                            alt={book.title}
                            style={{
                              width: "50px",
                              height: "60px",
                              objectFit: "cover",
                              borderRadius: "4px"
                            }}
                          />
                        ) : (
                          <span style={{ color: "#666" }}>No Image</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleReturnToStocks(book._id)}
                            className="return-btn"
                            title="Return to Active Books"
                          >
                            <FontAwesomeIcon icon={faUndo} /> Return
                          </button>
                          <button
                            onClick={() => handleDelete(book._id)}
                            className="delete-btn"
                            title="Delete Permanently"
                          >
                            <FontAwesomeIcon icon={faTrash} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ArchivedBooks;
