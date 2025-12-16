import React, { useEffect, useState } from 'react';
import './App.css';
import '../styles/pending-requests.css';

const PendingRequestTable = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedBorrow, setSelectedBorrow] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReservation, setSelectedReservation] = useState(null);

  useEffect(() => {
    fetchPendingRequest();
  }, []);

  const fetchPendingRequest = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5050/api/transactions/pending-requests?limit=10000');
      const data = await response.json();
      if (response.ok) {
        setPendingRequests(data.transactions || []);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch pending borrows');
      }
    } catch (err) {
      setError('Error connecting to server. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (borrowId) => {
    if (!window.confirm('Are you sure you want to approve this borrow request?')) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:5050/api/transactions/approve-borrow/${borrowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: localStorage.getItem('userEmail') || 'admin@example.com'
        }),
      });
      const data = await response.json();
      if (response.ok) {
        alert('Borrow request approved successfully');
        fetchPendingRequest();
      } else {
        alert(data.message || 'Failed to approve borrow request');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error approving borrow request. Please try again.');
    }
  };

  const openRejectModal = (borrow) => {
    setSelectedBorrow(borrow);
    setSelectedReservation(borrow);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    console.log('Rejection reason:', rejectionReason);
    console.log('Selected borrow:', selectedBorrow);
    if (!selectedBorrow || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    try {
      const response = await fetch(`http://localhost:5050/api/transactions/reject-borrow/${selectedBorrow._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: localStorage.getItem('userEmail') || 'admin@example.com',
          rejectionReason: rejectionReason.trim()
        }),
      });
      const data = await response.json();
      if (response.ok) {
        alert('Borrow request rejected successfully');
        setShowRejectModal(false);
        fetchPendingRequest();
      } else {
        alert(data.message || 'Failed to reject borrow request');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error rejecting borrow request. Please try again.');
    }
  };

  const handleApproveReservation = async (reservationId) => {
    if (!window.confirm('Are you sure you want to approve this reservation?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5050/api/transactions/approve-reservation/${reservationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: localStorage.getItem('userEmail') || 'admin@example.com'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Reservation approved successfully');
        fetchPendingRequest();
      } else {
        alert(data.message || 'Failed to approve reservation');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error approving reservation. Please try again.');
    }
  };

  const handleRejectReservation = async () => {
    if (!selectedReservation || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5050/api/transactions/reject-reservation/${selectedReservation._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: localStorage.getItem('userEmail') || 'admin@example.com',
          rejectionReason: rejectionReason.trim()
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Reservation rejected successfully');
        setShowRejectModal(false);
        fetchPendingRequest();
      } else {
        alert(data.message || 'Failed to reject reservation');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error rejecting reservation. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="pending-borrowing-container">
        <h2>Pending Borrow Requests</h2>
        <p>Loading borrow requests...</p>
      </div>
    );
  }

  const filteredBooks = pendingRequests.filter((book) =>
    book.bookTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pending-container">
      <div className="header-row">
        <h2 className="page-title">📌 Pending Requests</h2>

        <div className="search-container ">
          <input type="text" placeholder="Search analytics..." onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {!error && filteredBooks.length === 0 ? (
        <div className="empty-state">
          <img src="/imgs/empty.png" alt="No Data" className="empty-img" />
          <p>No pending requests found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Request Type</th>
                <th>Book Title</th>
                <th>User</th>
                <th>Date Requested</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredBooks.map((request) => (
                <tr key={request._id}>
                  <td className="type-cell">{request.type}</td>
                  <td className="title-cell">{request.bookTitle}</td>
                  <td>{request.userEmail}</td>
                  <td>{formatDate(request.createdAt)}</td>

                  <td className="action-buttons">
                    <button
                      onClick={() =>
                        request.type === "borrow"
                          ? handleApprove(request._id)
                          : handleApproveReservation(request._id)
                      }
                      className="btn approve"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => openRejectModal(request)}
                      className="btn reject"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-ui">
            <h3 className="modal-title">Reject Request</h3>

            <p><strong>Book:</strong> {selectedBorrow?.bookTitle}</p>
            <p><strong>User:</strong> {selectedBorrow?.userEmail}</p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
            ></textarea>

            <div className="modal-buttons">
              <button className="btn cancel" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>

              <button
                className="btn reject"
                onClick={() =>
                  selectedBorrow.type === "borrow"
                    ? handleReject()
                    : handleRejectReservation()
                }
              >
                Submit Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PendingRequestTable;
