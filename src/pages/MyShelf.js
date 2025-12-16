import { faBook, faBookmark, faHourglassHalf } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import "../styles/user-home.css";

const MyShelf = () => {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const userEmail = localStorage.getItem("userEmail");
  const [activeTab, setActiveTab] = useState("all");
  const [logs, setLogs] = useState([]);

  const fetchTransactions = useCallback(async () => {
    try {
      console.log('Fetching transactions for user:', userEmail);
      const res = await fetch(`https://paranaledge-y7z1.onrender.com/api/transactions/user/${userEmail}`);
      const data = await res.json();
      if (res.ok) {
        console.log('User transactions response:', data);

        const allTransactions = data.transactions || [];
        setTransactions(allTransactions);
      } else {
        console.error('Failed to load transactions:', data.message);
        setError(data.message || "Failed to load your books");
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError("Error loading your books");
    }
  }, [userEmail]);

  useEffect(() => {
    fetchTransactions();
    fetch("https://paranaledge-y7z1.onrender.com/api/logs")
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched logs:', data); // Debug log
        setLogs(data.logs);
      })
      .catch((err) => {
        console.error('Error fetching logs:', err); // Debug log
        setError("Failed to fetch logs.");
      });

  }, [fetchTransactions]);

  const handleReturn = async (transactionId) => {
    try {
      const res = await fetch(`https://paranaledge-y7z1.onrender.com/api/transactions/return/${transactionId}`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userEmail })
      });

      if (res.ok) {
        const data = await res.json();
        await Swal.fire({
          title: "Parañaledge",
          text: "Book returned successfully!",
          icon: "success",
          confirmButtonText: "OK"
        });
        fetchTransactions();
      } else {
        // Handle non-JSON responses
        let errorMessage = "Failed to return book";
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errorMessage = data.message || errorMessage;
        }
        await Swal.fire({
          title: "Parañaledge",
          text: errorMessage,
          icon: "error",
          confirmButtonText: "OK"
        });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        title: "Parañaledge",
        text: "Error returning book",
        icon: "error",
        confirmButtonText: "OK"
      });
    }
  };

  const handleCancel = async (transactionId, type) => {
    try {
      // Use the appropriate endpoint based on transaction type
      const endpoint = type === 'reserve' 
        ? `https://paranaledge-y7z1.onrender.com/api/transactions/cancel-reservation/${transactionId}`
        : `https://paranaledge-y7z1.onrender.com/api/transactions/cancel-pending/${transactionId}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userEmail })
      });

      if (res.ok) {
        const data = await res.json();
        await Swal.fire({
          title: "Parañaledge",
          text: "Request cancelled successfully!",
          icon: "success",
          confirmButtonText: "OK"
        });
        fetchTransactions();
      } else {
        // Handle non-JSON responses
        let errorMessage = "Failed to cancel request";
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errorMessage = data.message || errorMessage;
        }
        await Swal.fire({
          title: "Parañaledge",
          text: errorMessage,
          icon: "error",
          confirmButtonText: "OK"
        });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        title: "Parañaledge",
        text: "Error cancelling request",
        icon: "error",
        confirmButtonText: "OK"
      });
    }
  };
  const handleBorrowReserved = async (transactionId) => {
    try {
      const res = await fetch(`https://paranaledge-y7z1.onrender.com/api/transactions/${transactionId}/borrow-reserved`, {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userEmail })
      });

      if (res.ok) {
        alert("Book borrowed successfully!");
        fetchTransactions();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to borrow book");
      }
    } catch (err) {
      console.error(err);
      alert("Error borrowing book");
    }
  };  const borrowedBooks = transactions.filter(t => t.type === 'borrow' && t.status === 'active');
  const reservedBooks = transactions.filter(t =>
    t.type === 'reserve' && t.status === 'active'
  );
  const completedBooks = transactions.filter(t => t.type === 'borrow' && t.status === 'completed');
  const pendingBooks = transactions.filter(t => 
    (t.type === 'borrow' || t.type === 'reserve') && t.status === 'pending'
  );

  // Get filtered items based on active tab
  const getFilteredItems = () => {
    switch(activeTab) {
      case 'borrowed':
        return borrowedBooks;
      case 'reserved':
        return reservedBooks;
      case 'completed':
        return completedBooks;
      case 'pending':
        return pendingBooks;
      default:
        return [
          ...borrowedBooks,
          ...reservedBooks,
          ...completedBooks,
          ...pendingBooks
        ];
    }
  };

  const filteredItems = getFilteredItems();

  // Count all items for display
  const allCount = borrowedBooks.length + reservedBooks.length + completedBooks.length + pendingBooks.length;


  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ fontWeight: '600', fontSize: '25px', marginBottom: '20px' }}>My Shelf</h2>

      {error && <div className="error-msg">{error}</div>}

      {/* Filter Tabs */}
      <div className="shelf-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All ({allCount})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'borrowed' ? 'active' : ''}`}
          onClick={() => setActiveTab('borrowed')}
        >
          Borrowed ({borrowedBooks.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reserved' ? 'active' : ''}`}
          onClick={() => setActiveTab('reserved')}
        >
          Reserved ({reservedBooks.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({completedBooks.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingBooks.length})
        </button>
      </div>

      {/* Cards Container */}
      <div className="shelf-cards-container">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <div key={item._id} className="shelf-card">
              <h3>{item.bookTitle}</h3>
              
              <div className="shelf-card-badge">
                {item.status === 'pending' ? (
                  <span className="badge pending">⏱ Pending</span>
                ) : item.type === 'borrow' ? (
                  <span className="badge borrowed">📖 Borrowed</span>
                ) : (
                  <span className="badge reserved">♦ Reserved</span>
                )}
              </div>

              <div className="shelf-card-info">
                <p className="info-label">REQUEST DATE:</p>
                <p className="info-value">
                  {new Date(item.startDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}, {new Date(item.startDate).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {item.endDate && item.status !== 'pending' && (
                <div className="shelf-card-info">
                  <p className="info-label">DUE DATE:</p>
                  <p className="info-value">
                    {new Date(item.endDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {item.type === 'borrow' && item.status === 'active' && (
                <div className="shelf-card-actions">
                  <button 
                    className="shelf-card-btn return-btn"
                    onClick={() => handleReturn(item._id)}
                  >
                    Return
                  </button>
                </div>
              )}

              {(item.status === 'pending' || item.type === 'reserve') && (
                <div className="shelf-card-actions">
                  <button 
                    className="shelf-card-btn cancel-btn"
                    onClick={() => handleCancel(item._id, item.type)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-shelf">
            <p>No books in this category</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyShelf;
