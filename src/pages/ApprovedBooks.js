import React, { useState, useEffect } from 'react';
import '../components/App.css';

const ApprovedBooks = () => {
  const [approvedBooks, setApprovedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchApprovedBooks();
  }, []);

  const fetchApprovedBooks = async () => {
    try {
      const response = await fetch('http://localhost:5050/api/approved-books');
      if (!response.ok) {
        throw new Error('Failed to fetch approved books');
      }
      const data = await response.json();
      setApprovedBooks(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const filteredBooks = approvedBooks.filter(book => {
    const matchesSearch = (book.title?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                         (book.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesStatus = filterStatus === 'all' || book.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#4CAF50'; // Green
      case 'returned':
        return '#2196F3'; // Blue
      default:
        return '#757575'; // Grey
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="approved-books-container">
      <h2 style={{ fontWeight: '600', fontSize: '25px', marginTop: "-5px" }}>Approved Books</h2>
      
      <div className="filters">
        <input
          type="text"
          placeholder="Search by title or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="status-filter"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="table-container">
        <table className="approved-books-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>User</th>
              <th>Borrow Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Approved By</th>
              <th>Return Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book) => (
              <tr key={book._id}>
                <td>{book.title}</td>
                <td>{book.userEmail}</td>
                <td>{formatDate(book.borrowDate)}</td>
                <td>{formatDate(book.returnDate)}</td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(book.status) }}
                  >
                    {book.status}
                  </span>
                </td>
                <td>{book.approvedBy}</td>
                <td>
                  {book.actualReturnDate ? formatDate(book.actualReturnDate) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredBooks.length === 0 && (
        <div className="no-books">
          No approved books found
        </div>
      )}
    </div>
  );
};

export default ApprovedBooks;
