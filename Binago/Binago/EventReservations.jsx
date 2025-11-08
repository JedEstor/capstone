import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Title from "../../components/Title";

const formatDateRange = (dateRange) => {
  if (!dateRange.includes(" to ")) return dateRange;

  const [start, end] = dateRange.split(" to ");
  
  // Helper function to format date without timezone issues
  const format = (dateStr) => {
    if (!dateStr) return "Invalid Date";
    
    try {
      // Handle date strings (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
      const datePart = dateStr.split('T')[0].split(' ')[0]; // Get just YYYY-MM-DD part
      const [year, month, day] = datePart.split('-').map(Number);
      
      // Create date using local time to avoid timezone shifts
      const date = new Date(year, month - 1, day);
      
      if (isNaN(date.getTime())) return "Invalid Date";
      
      // Format as "Nov 26, 2025" using local date components
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      console.warn("Error formatting date:", dateStr, e);
      return dateStr; // Return original if parsing fails
    }
  };

  return `${format(start)} - ${format(end)}`;
};

const EventReservations = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchReservations();
  }, []);

  const filteredReservations = reservations.filter((res) => {
    return (
      (filter === "All" || res.status === filter) &&
      (res.eventName.toLowerCase().includes(search.toLowerCase()) ||
        res.customer.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const totalItems = filteredReservations.length;
  const paginated = filteredReservations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleView = (res) => setSelectedReservation(res);
  const closeModal = () => setSelectedReservation(null);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:3000/api/eventBookings");
      const data = await res.json();

      if (data?.success) {
        const normalized = data.data.map((row) => ({
          id: row.id || row._id,
          eventName: (row.event_type && row.event_type !== '0' && row.event_type !== 0) 
            ? row.event_type 
            : (row.event_name && row.event_name !== '0' && row.event_name !== 0)
              ? row.event_name 
              : "Event",
          customer: row.customer_name,
          date:
            row.event_start_date && row.event_end_date
              ? `${row.event_start_date} to ${row.event_end_date}`
              : row.event_start_date || row.event_end_date || "-",
          status: row.status || "Pending",
          notes: row.special_request || "",
          raw: row,
        }));

        setReservations(normalized);
      } else {
        setError("Failed to load reservations");
      }
    } catch {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      setUpdatingId(id);
      const url = `http://localhost:3000/api/eventBookings/${id}/status`;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ status: "Confirmed" }),
      });

      // Check if response is ok
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data?.success) {
        setReservations((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "Confirmed" } : r))
        );
        navigate("/owner/event-reservations-logs");
      } else {
        // Show the actual error message from backend
        const errorMsg = data?.message || data?.error || "Failed to confirm reservation";
        alert(`Failed to confirm reservation: ${errorMsg}`);
        console.error("Confirmation failed:", data);
      }
    } catch (error) {
      console.error("Error confirming reservation:", error);
      alert(`Error confirming reservation: ${error.message || "Network error. Please check your server connection."}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDecline = async (id) => {
    try {
      setUpdatingId(id);
      const response = await fetch(
        `http://localhost:3000/api/eventBookings/${id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "Cancelled" }),
        }
      );

      const data = await response.json();

      if (data?.success) {
        setReservations((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "Cancelled" } : r))
        );
        await fetchReservations();
      } else {
        alert("Failed to decline reservation");
      }
    } catch (error) {
      alert("Error declining reservation");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <Title title="Event Reservations" />

        {/* FILTERS */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="text"
              placeholder="Search by event type or customer..."
              className="w-full md:w-1/2 border border-gray-300 rounded-lg px-4 py-2 text-gray-600 focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full md:w-40 border border-gray-300 rounded-lg px-3 py-2 text-gray-600 focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-sm font-semibold">
                <th className="p-3 border-b">#</th>
                <th className="p-3 border-b">Event Type</th>
                <th className="p-3 border-b">Customer</th>
                <th className="p-3 border-b">Date(s)</th>
                <th className="p-3 border-b">Details</th>
                <th className="p-3 border-b">Status</th>
                <th className="p-3 border-b text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="text-sm text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : paginated.length > 0 ? (
                paginated.map((res, index) => (
                  <tr key={res.id} className="hover:bg-gray-50">
                    <td className="p-3 border-b">
                      {index + 1 + (currentPage - 1) * itemsPerPage}
                    </td>
                    <td className="p-3 border-b font-medium">{res.eventName}</td>
                    <td className="p-3 border-b">{res.customer}</td>
                    <td className="p-3 border-b">{formatDateRange(res.date)}</td>
                    <td className="p-3 border-b">
                      <button
                        onClick={() => handleView(res)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View
                      </button>
                    </td>
                    <td className="p-3 border-b">
                      <span
                        className={`px-3 py-1 text-xs rounded-full font-medium ${
                          res.status === "Confirmed"
                            ? "bg-green-100 text-green-700"
                            : res.status === "Pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {res.status}
                      </span>
                    </td>
                    <td className="p-3 border-b text-center space-x-2">
                      <button
                        onClick={() => handleConfirm(res.id)}
                        disabled={
                          updatingId === res.id || res.status === "Confirmed"
                        }
                        className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {updatingId === res.id ? "Updating..." : "Confirm"}
                      </button>

                      <button
                        onClick={() => handleDecline(res.id)}
                        disabled={
                          updatingId === res.id || res.status === "Cancelled"
                        }
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {updatingId === res.id ? "Updating..." : "Decline"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-gray-500">
                    No reservations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
            reservations
          </span>

          <div className="space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Previous
            </button>

            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * itemsPerPage >= totalItems}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {selectedReservation && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b">
              Reservation Details
            </h2>

            <p>
              <strong>Event Type:</strong> {selectedReservation.eventName}
            </p>
            <p>
              <strong>Customer:</strong> {selectedReservation.customer}
            </p>
            <p>
              <strong>Date(s):</strong> {formatDateRange(selectedReservation.date)}
            </p>

            {selectedReservation.raw.email && (
              <p>
                <strong>Email:</strong> {selectedReservation.raw.email}
              </p>
            )}

            {selectedReservation.raw.contact_number && (
              <p>
                <strong>Contact:</strong> {selectedReservation.raw.contact_number}
              </p>
            )}

            {selectedReservation.notes && (
              <p>
                <strong>Notes:</strong> {selectedReservation.notes}
              </p>
            )}

            <button
              onClick={() => setSelectedReservation(null)}
              className="mt-5 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventReservations;
