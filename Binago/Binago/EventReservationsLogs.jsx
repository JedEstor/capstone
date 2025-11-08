import React, { useEffect, useState } from "react";
import Title from "../../components/Title";

const formatDateRange = (dateRange) => {
  // Handle cases where dateRange is "-" or empty
  if (!dateRange || dateRange === "-" || !dateRange.includes(" to ")) {
    return dateRange || "-";
  }

  try {
    // Split by " to " (with spaces on both sides)
    const [startStr, endStr] = dateRange.split(" to ").map(s => s.trim());
    
    // Format date function that handles various date formats
    const formatDate = (dateStr) => {
      if (!dateStr) return "Invalid Date";
      
      // Try to parse the date - handles formats like "2025-11-28", "2025-11-28T00:00:00.000Z", etc.
      const date = new Date(dateStr.trim());
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      
      // Format as "Nov 28, 2025"
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const formattedStart = formatDate(startStr);
    const formattedEnd = formatDate(endStr);
    
    // If either date is invalid, return the original string
    if (formattedStart === "Invalid Date" || formattedEnd === "Invalid Date") {
      return dateRange;
    }
    
    return `${formattedStart} – ${formattedEnd}`;
  } catch (error) {
    console.error("Error formatting date range:", error, dateRange);
    return dateRange;
  }
};

const EventReservationsLogs = () => {
  const [confirmedReservations, setConfirmedReservations] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);

        const res = await fetch("http://localhost:3000/api/eventBookings/logs");
        const data = await res.json();

        if (data?.success && data.data.length > 0) {
          const confirmed = data.data.map((row) => {
            // Helper function to format date without timezone issues
            const formatDateLocal = (dateInput) => {
              if (!dateInput) return null;
              
              try {
                let date;
                if (dateInput instanceof Date) {
                  date = dateInput;
                } else if (typeof dateInput === 'string') {
                  // Handle datetime strings (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD)
                  const dateStr = dateInput.split('T')[0].split(' ')[0]; // Get just YYYY-MM-DD part
                  const [year, month, day] = dateStr.split('-').map(Number);
                  // Create date using local time to avoid timezone shifts
                  date = new Date(year, month - 1, day);
                } else {
                  date = new Date(dateInput);
                }
                
                if (isNaN(date.getTime())) return null;
                
                // Format as YYYY-MM-DD using local date components
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              } catch (e) {
                console.warn("Error formatting date:", dateInput, e);
                return null;
              }
            };
            
            const startDate = formatDateLocal(row.event_start_date);
            const endDate = formatDateLocal(row.event_end_date);

            return {
              id: row.log_id || row.id,
              eventName: (row.event_type && row.event_type !== '0' && row.event_type !== 0) 
                ? row.event_type 
                : (row.event_name && row.event_name !== '0' && row.event_name !== 0)
                  ? row.event_name 
                  : "Event",
              customer: row.customer_name,
              email: row.email,
              contact: row.contact_number,
              date: startDate && endDate ? `${startDate} to ${endDate}` : "-",
              notes: row.special_request || "",
            };
          });

          setConfirmedReservations(confirmed);
        } else {
          const fallbackRes = await fetch("http://localhost:3000/api/eventBookings");
          const fallbackData = await fallbackRes.json();

          if (fallbackData?.success) {
            const confirmed = fallbackData.data
              .filter((row) => row.status === "Confirmed")
              .map((row) => {
                // Helper function to format date without timezone issues
                const formatDateLocal = (dateInput) => {
                  if (!dateInput) return null;
                  
                  try {
                    let date;
                    if (dateInput instanceof Date) {
                      date = dateInput;
                    } else if (typeof dateInput === 'string') {
                      // Handle datetime strings (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD)
                      const dateStr = dateInput.split('T')[0].split(' ')[0]; // Get just YYYY-MM-DD part
                      const [year, month, day] = dateStr.split('-').map(Number);
                      // Create date using local time to avoid timezone shifts
                      date = new Date(year, month - 1, day);
                    } else {
                      date = new Date(dateInput);
                    }
                    
                    if (isNaN(date.getTime())) return null;
                    
                    // Format as YYYY-MM-DD using local date components
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  } catch (e) {
                    console.warn("Error formatting date:", dateInput, e);
                    return null;
                  }
                };
                
                const startDate = formatDateLocal(row.event_start_date);
                const endDate = formatDateLocal(row.event_end_date);

                return {
                  id: row.id || row._id,
                  eventName: (row.event_type && row.event_type !== '0' && row.event_type !== 0) 
                    ? row.event_type 
                    : (row.event_name && row.event_name !== '0' && row.event_name !== 0)
                      ? row.event_name 
                      : "Event",
                  customer: row.customer_name,
                  email: row.email,
                  contact: row.contact_number,
                  date: startDate && endDate ? `${startDate} to ${endDate}` : "-",
                  notes: row.special_request || "",
                };
              });

            setConfirmedReservations(confirmed);
          }
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = confirmedReservations.filter((log) =>
    `${log.eventName} ${log.customer} ${log.email}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <Title title="Event Reservation Logs" />

        {/* FILTER BAR */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="text"
              placeholder="Search event, customer or email..."
              className="w-full md:w-1/2 border border-gray-300 rounded-lg px-4 py-2 text-gray-600 focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                <th className="p-3 border-b">Email</th>
                <th className="p-3 border-b">Contact</th>
                <th className="p-3 border-b">Date(s)</th>
                <th className="p-3 border-b">Notes</th>
              </tr>
            </thead>

            <tbody className="text-sm text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-gray-500">
                    Loading logs...
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((res, i) => (
                    <tr key={res.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">
                        {i + 1 + (currentPage - 1) * itemsPerPage}
                      </td>
                      <td className="p-3 border-b font-medium">{res.eventName}</td>
                      <td className="p-3 border-b">{res.customer}</td>
                      <td className="p-3 border-b">{res.email}</td>
                      <td className="p-3 border-b">{res.contact}</td>
                      <td className="p-3 border-b">{formatDateRange(res.date)}</td>
                      <td className="p-3 border-b">{res.notes}</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-gray-500">
                    No confirmed reservations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1} –
            {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of{" "}
            {filteredLogs.length} logs
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
              disabled={currentPage * itemsPerPage >= filteredLogs.length}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventReservationsLogs;
