import express from "express";
import connectDB from "../configs/db.js";

const router = express.Router();

// Log all requests to this router for debugging
router.use((req, res, next) => {
  console.log(`\n📥 ===== EVENT BOOKINGS ROUTER =====`);
  console.log(`📥 Method: ${req.method}`);
  console.log(`📥 Path: ${req.path}`);
  console.log(`📥 Full URL: ${req.originalUrl}`);
  console.log(`📥 Body:`, req.body);
  console.log(`📥 =================================\n`);
  next();
});

// GET: list all event bookings
router.get("/", async (req, res) => {
  try {
    const db = await connectDB();
    const [rows] = await db.query(
      "SELECT * FROM event_bookings ORDER BY event_start_date DESC"
    );
    
    // Format dates to ensure they're in YYYY-MM-DD format for consistent parsing
    const formatDate = (date) => {
      if (!date) return null;
      // If it's already a string in YYYY-MM-DD format, return it
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
        return date.split('T')[0]; // Get just the date part if there's time
      }
      // If it's a Date object, format it
      if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }
      // Otherwise, try to parse it
      try {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn("Could not parse date:", date);
      }
      return date;
    };
    
    const formattedRows = rows.map((row) => ({
      ...row,
      event_start_date: formatDate(row.event_start_date),
      event_end_date: formatDate(row.event_end_date),
    }));
    
    // Debug: Log first row to see what data is being returned
    if (formattedRows.length > 0) {
      console.log("📊 Sample event booking data:", {
        id: formattedRows[0].id,
        event_type: formattedRows[0].event_type,
        customer_name: formattedRows[0].customer_name,
        has_event_type: formattedRows[0].hasOwnProperty('event_type'),
      });
    }
    
    res.json({ success: true, data: formattedRows });
  } catch (error) {
    console.error("❌ Database Error:", error);
    res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

// GET: Get event reservation logs (confirmed reservations)
// IMPORTANT: Specific routes must come BEFORE parameterized routes
router.get("/logs", async (req, res) => {
  try {
    const db = await connectDB();
    const [rows] = await db.query(
      "SELECT * FROM event_reservation_logs ORDER BY confirmed_at DESC"
    );
    
    // Format dates to avoid timezone issues - use local date components
    const formattedRows = rows.map((row) => {
      const formatDate = (dateInput) => {
        if (!dateInput) return null;
        
        try {
          let date;
          if (dateInput instanceof Date) {
            date = dateInput;
          } else if (typeof dateInput === 'string') {
            // Handle datetime strings from MySQL (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD)
            const dateStr = dateInput.split('T')[0].split(' ')[0]; // Get just YYYY-MM-DD part
            const [year, month, day] = dateStr.split('-').map(Number);
            // Create date using local time to avoid timezone shifts
            date = new Date(year, month - 1, day);
          } else {
            date = new Date(dateInput);
          }
          
          if (isNaN(date.getTime())) {
            console.warn("Invalid date:", dateInput);
            return null;
          }
          
          // Format as YYYY-MM-DD using local date components
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } catch (e) {
          console.warn("Could not parse date:", dateInput, e);
          return null;
        }
      };

      return {
        ...row,
        event_start_date: formatDate(row.event_start_date),
        event_end_date: formatDate(row.event_end_date),
      };
    });
    
    // Debug: Log first row to see what data is being returned
    if (formattedRows.length > 0) {
      console.log("📊 Sample event reservation log data:", {
        log_id: formattedRows[0].log_id,
        event_type: formattedRows[0].event_type,
        event_name: formattedRows[0].event_name,
        customer_name: formattedRows[0].customer_name,
        has_event_type: formattedRows[0].hasOwnProperty('event_type'),
        has_event_name: formattedRows[0].hasOwnProperty('event_name'),
      });
    }
    
    res.json({ success: true, data: formattedRows });
  } catch (error) {
    console.error("❌ Database Error:", error);
    // If table doesn't exist, return empty array instead of error
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, data: [] });
    }
    res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

router.post("/", async (req, res) => {
  const {
    customer_name,
    email,
    contact_number,
    special_request,
    event_name,
    event_type,
    event_start_date,
    event_end_date,
  } = req.body;
  
  // Support both event_name and event_type for backward compatibility
  const eventType = event_type || event_name;

  console.log("📥 Received request body:", {
    event_type,
    event_name,
    final_eventType: eventType,
    customer_name,
  });

  if (!customer_name || !email || !contact_number) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  // Validate dates
  if (!event_start_date || !event_end_date) {
    return res.status(400).json({ message: "Event start and end dates are required." });
  }

  // Warn if event type is missing
  if (!eventType || eventType.trim() === '') {
    console.warn("⚠️ WARNING: event_type is missing or empty in request!");
  }

  try {
    const db = await connectDB();

    // Helper function to format date to YYYY-MM-DD (handles various input formats)
    const formatDate = (dateInput) => {
      if (!dateInput) return null;
      
      // If already in YYYY-MM-DD format, return as is
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
      }
      
      // Try to parse as Date and format
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
          throw new Error("Invalid date");
        }
        // Use local date components to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (e) {
        console.warn("Could not parse date:", dateInput);
        return dateInput; // Return as-is if parsing fails
      }
    };

    const formattedStartDate = formatDate(event_start_date);
    const formattedEndDate = formatDate(event_end_date);

    console.log("📝 Creating event booking:", {
      customer_name,
      event_type: eventType,
      event_start_date: formattedStartDate,
      event_end_date: formattedEndDate,
    });

    // Check for date conflicts with confirmed bookings
    try {
      // Check in event_bookings table for confirmed bookings
      // Date overlap logic: two ranges overlap if start1 <= end2 AND start2 <= end1
      const [conflictCheck] = await db.query(
        `SELECT id, customer_name, event_start_date, event_end_date, status 
         FROM event_bookings 
         WHERE status = 'Confirmed' 
         AND DATE(event_start_date) <= DATE(?) 
         AND DATE(event_end_date) >= DATE(?)`,
        [formattedEndDate, formattedStartDate]
      );

      // Also check in event_reservation_logs table (confirmed reservations are logged there)
      let [logConflictCheck] = [];
      try {
        [logConflictCheck] = await db.query(
          `SELECT log_id, customer_name, event_start_date, event_end_date 
           FROM event_reservation_logs 
           WHERE status = 'Confirmed' 
           AND DATE(event_start_date) <= DATE(?) 
           AND DATE(event_end_date) >= DATE(?)`,
          [formattedEndDate, formattedStartDate]
        );
      } catch (logErr) {
        // If logs table doesn't exist or has issues, that's okay - we'll just check bookings
        console.log("⚠️ Could not check logs table for conflicts:", logErr.message);
      }

      const hasConflict = conflictCheck.length > 0 || (logConflictCheck && logConflictCheck.length > 0);
      
      if (hasConflict) {
        const conflictingBooking = conflictCheck[0] || (logConflictCheck && logConflictCheck[0]);
        let conflictStart = conflictingBooking?.event_start_date || 'N/A';
        let conflictEnd = conflictingBooking?.event_end_date || 'N/A';
        
        // Format dates for display (extract just the date part if it's datetime)
        if (conflictStart && conflictStart !== 'N/A') {
          conflictStart = String(conflictStart).split('T')[0].split(' ')[0];
        }
        if (conflictEnd && conflictEnd !== 'N/A') {
          conflictEnd = String(conflictEnd).split('T')[0].split(' ')[0];
        }
        
        console.log("❌ Date conflict detected:", {
          requested: `${formattedStartDate} to ${formattedEndDate}`,
          conflicting: `${conflictStart} to ${conflictEnd}`,
          customer: conflictingBooking?.customer_name
        });

        // Format dates for user-friendly display
        const formatDateForDisplay = (dateStr) => {
          if (!dateStr || dateStr === 'N/A') return dateStr;
          try {
            const [year, month, day] = dateStr.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          } catch (e) {
            return dateStr;
          }
        };

        const formattedConflictStart = formatDateForDisplay(conflictStart);
        const formattedConflictEnd = formatDateForDisplay(conflictEnd);
        const dateRange = formattedConflictStart === formattedConflictEnd 
          ? formattedConflictStart 
          : `${formattedConflictStart} to ${formattedConflictEnd}`;

        return res.status(409).json({ 
          message: `This date is already booked. A confirmed event reservation exists on ${dateRange}. Please choose different dates.`,
          conflict: true,
          conflictingDates: {
            start: conflictStart,
            end: conflictEnd
          }
        });
      }
    } catch (conflictErr) {
      // If conflict check fails, log but continue (don't block booking)
      console.error("⚠️ Error checking for date conflicts:", conflictErr.message);
      console.log("⚠️ Continuing with booking creation despite conflict check error");
    }

    // Check if event_type column exists, if not, add it automatically
    let query, params;
    try {
      // Try to insert with event_type first
      query = "INSERT INTO event_bookings (customer_name, email, contact_number, special_request, event_type, event_start_date, event_end_date) VALUES (?, ?, ?, ?, ?, ?, ?)";
      // Ensure eventType is trimmed and not empty
      const eventTypeValue = eventType && eventType.trim() !== '' ? eventType.trim() : null;
      params = [
        customer_name,
        email,
        contact_number,
        special_request || null,
        eventTypeValue,
        formattedStartDate,
        formattedEndDate,
      ];
      
      const [result] = await db.query(query, params);
      console.log("✅ Event booking created successfully!");
      console.log("   - Insert ID:", result.insertId);
      console.log("   - Event Type:", eventType);
      console.log("   - Customer:", customer_name);
      
      // Verify the data was stored correctly
      const [verifyRows] = await db.query(
        "SELECT id, customer_name, event_type FROM event_bookings WHERE id = ?",
        [result.insertId]
      );
      if (verifyRows.length > 0) {
        console.log("✅ Verification - Stored data:", {
          id: verifyRows[0].id,
          customer_name: verifyRows[0].customer_name,
          event_type: verifyRows[0].event_type,
        });
      }
    } catch (error) {
      // If event_type column doesn't exist, add it and retry
      if (error.code === 'ER_BAD_FIELD_ERROR' && (error.message.includes('event_type') || error.message.includes('event_name'))) {
        console.warn("⚠️ event_type column doesn't exist. Adding it now...");
        try {
          // Add the event_type column
          await db.query(
            `ALTER TABLE event_bookings 
             ADD COLUMN event_type VARCHAR(255) NULL 
             AFTER contact_number`
          );
          console.log("✅ event_type column added successfully");
          
          // Retry the insert with event_type
          const [retryResult] = await db.query(query, params);
          console.log("✅ Event booking created with event_type after adding column!");
          console.log("   - Insert ID:", retryResult.insertId);
          console.log("   - Event Type:", eventType);
          
          // Verify the data was stored correctly
          const [verifyRows] = await db.query(
            "SELECT id, customer_name, event_type FROM event_bookings WHERE id = ?",
            [retryResult.insertId]
          );
          if (verifyRows.length > 0) {
            console.log("✅ Verification - Stored data:", {
              id: verifyRows[0].id,
              customer_name: verifyRows[0].customer_name,
              event_type: verifyRows[0].event_type,
            });
          }
        } catch (alterError) {
          console.error("⚠️ Could not add event_type column:", alterError.message);
          // Fallback: insert without event_type
          console.warn("⚠️ Inserting without event_type column");
          query = "INSERT INTO event_bookings (customer_name, email, contact_number, special_request, event_start_date, event_end_date) VALUES (?, ?, ?, ?, ?, ?)";
          params = [
            customer_name,
            email,
            contact_number,
            special_request || null,
            formattedStartDate,
            formattedEndDate,
          ];
          await db.query(query, params);
        }
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

    res.status(201).json({ message: "Event booking saved successfully!" });
  } catch (error) {
    console.error("❌ Database Error:", error);
    res.status(500).json({ 
      message: "Database error occurred.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test endpoint - must come BEFORE parameterized route
router.put("/test", (req, res) => {
  res.json({ success: true, message: "PUT route is working", timestamp: new Date().toISOString() });
});

// Handle OPTIONS (CORS preflight) for PUT requests
router.options("/:id/status", (req, res) => {
  res.header('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Debug: Add GET handler to see if requests are coming as GET
router.get("/:id/status", (req, res) => {
  console.log("⚠️ WARNING: Received GET request instead of PUT!");
  console.log("⚠️ This route only accepts PUT requests");
  res.status(405).json({ 
    success: false, 
    message: "Method not allowed. This endpoint only accepts PUT requests.",
    receivedMethod: "GET",
    expectedMethod: "PUT"
  });
});

// PUT: Update event booking status and log confirmed reservations
router.put("/:id/status", async (req, res) => {
  console.log(`\n🔵 ===== PUT /:id/status ROUTE HIT =====`);
  console.log(`🔵 ID from params: ${req.params.id}`);
  console.log(`🔵 Request body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔵 Status value: ${req.body?.status}`);
  console.log(`🔵 ======================================\n`);
  
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      console.log("❌ Status is missing in request body");
      return res.status(400).json({ success: false, message: "Status is required." });
    }

    if (!id) {
      console.log("❌ ID is missing in request params");
      return res.status(400).json({ success: false, message: "Booking ID is required." });
    }

    console.log(`📝 Updating event booking ${id} to status: ${status}`);
    console.log(`📝 ID type: ${typeof id}, value: ${id}`);

    const db = await connectDB();
    
    // Try to get booking by 'id' first (most common)
    let bookingRows;
    let primaryKeyColumn = 'id';
    let bookingId = id;
    
    // Try to parse ID as integer if it's a string number
    const parsedId = isNaN(id) ? id : parseInt(id, 10);
    
    try {
      // First, try with SELECT * to get all columns (more flexible)
      // MySQL will handle type coercion automatically
      [bookingRows] = await db.query(
        `SELECT * FROM event_bookings WHERE id = ? LIMIT 1`,
        [parsedId]
      );
      
      if (bookingRows.length === 0) {
        // Try booking_id as alternative if id column doesn't work
        try {
          [bookingRows] = await db.query(
            `SELECT * FROM event_bookings WHERE booking_id = ? LIMIT 1`,
            [parsedId]
          );
          if (bookingRows.length > 0) {
            primaryKeyColumn = 'booking_id';
          }
        } catch (altErr) {
          // booking_id column might not exist, that's okay
          console.log("⚠️ booking_id column might not exist, using id only");
        }
      }
    } catch (err) {
      console.error("❌ Error fetching booking:", err.message);
      console.error("❌ Error details:", {
        code: err.code,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage,
        sql: err.sql
      });
      return res.status(500).json({ 
        success: false, 
        message: "Error fetching event booking.",
        error: err.message,
        details: process.env.NODE_ENV === 'development' ? {
          code: err.code,
          sqlState: err.sqlState,
          sqlMessage: err.sqlMessage
        } : undefined
      });
    }

    if (!bookingRows || bookingRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `Event booking with ID ${id} not found.` 
      });
    }

    const booking = bookingRows[0];
    bookingId = booking[primaryKeyColumn] || booking.id || booking.booking_id || id;
    console.log(`✅ Found booking:`, { 
      id: bookingId, 
      customer: booking.customer_name,
      event_type: booking.event_type,
      event_name: booking.event_name,
      has_event_type: booking.hasOwnProperty('event_type'),
      has_event_name: booking.hasOwnProperty('event_name'),
    });

    // If trying to confirm, check if there's already a confirmed booking on the same dates
    if (status === 'Confirmed') {
      try {
        const bookingStartDate = booking.event_start_date;
        const bookingEndDate = booking.event_end_date;
        
        if (bookingStartDate && bookingEndDate) {
          // Format dates for comparison
          const formatDateForQuery = (dateInput) => {
            if (!dateInput) return null;
            const dateStr = String(dateInput).split('T')[0].split(' ')[0];
            return dateStr;
          };
          
          const formattedStart = formatDateForQuery(bookingStartDate);
          const formattedEnd = formatDateForQuery(bookingEndDate);
          
          console.log("🔍 Checking for existing confirmed bookings on dates:", {
            start: formattedStart,
            end: formattedEnd,
            currentBookingId: bookingId
          });
          
          // Check in event_bookings table for already confirmed bookings
          const [existingConfirmed] = await db.query(
            `SELECT id, customer_name, event_start_date, event_end_date 
             FROM event_bookings 
             WHERE ${primaryKeyColumn} != ? 
             AND status = 'Confirmed'
             AND DATE(event_start_date) <= DATE(?) 
             AND DATE(event_end_date) >= DATE(?)`,
            [bookingId, formattedEnd, formattedStart]
          );
          
          // Also check in event_reservation_logs table
          let [logConfirmed] = [];
          try {
            [logConfirmed] = await db.query(
              `SELECT log_id, customer_name, event_start_date, event_end_date 
               FROM event_reservation_logs 
               WHERE status = 'Confirmed'
               AND DATE(event_start_date) <= DATE(?) 
               AND DATE(event_end_date) >= DATE(?)`,
              [formattedEnd, formattedStart]
            );
          } catch (logErr) {
            // If logs table doesn't exist, that's okay
            console.log("⚠️ Could not check logs table:", logErr.message);
          }
          
          if (existingConfirmed.length > 0 || (logConfirmed && logConfirmed.length > 0)) {
            const conflictingBooking = existingConfirmed[0] || (logConfirmed && logConfirmed[0]);
            let conflictStart = conflictingBooking?.event_start_date || 'N/A';
            let conflictEnd = conflictingBooking?.event_end_date || 'N/A';
            
            // Format dates for display
            if (conflictStart && conflictStart !== 'N/A') {
              conflictStart = String(conflictStart).split('T')[0].split(' ')[0];
            }
            if (conflictEnd && conflictEnd !== 'N/A') {
              conflictEnd = String(conflictEnd).split('T')[0].split(' ')[0];
            }
            
            // Format dates for user-friendly display
            const formatDateForDisplay = (dateStr) => {
              if (!dateStr || dateStr === 'N/A') return dateStr;
              try {
                const [year, month, day] = dateStr.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              } catch (e) {
                return dateStr;
              }
            };
            
            const formattedConflictStart = formatDateForDisplay(conflictStart);
            const formattedConflictEnd = formatDateForDisplay(conflictEnd);
            const dateRange = formattedConflictStart === formattedConflictEnd 
              ? formattedConflictStart 
              : `${formattedConflictStart} to ${formattedConflictEnd}`;
            
            console.log("❌ Cannot confirm - already confirmed booking exists:", {
              requested: `${formattedStart} to ${formattedEnd}`,
              conflicting: `${conflictStart} to ${conflictEnd}`,
              customer: conflictingBooking?.customer_name
            });
            
            return res.status(409).json({ 
              success: false,
              message: `Cannot confirm this reservation. There is already a confirmed event reservation on ${dateRange}. Please decline this reservation or choose different dates.`,
              conflict: true,
              conflictingDates: {
                start: conflictStart,
                end: conflictEnd
              },
              conflictingCustomer: conflictingBooking?.customer_name
            });
          }
        }
      } catch (checkErr) {
        // If check fails, log but allow confirmation to proceed (fail open)
        console.error("⚠️ Error checking for existing confirmed bookings:", checkErr.message);
        console.log("⚠️ Proceeding with confirmation despite check error");
      }
    }

    // Try to update status column
    let statusUpdated = false;
    let declinedCount = 0;
    let declinedBookings = [];
    
    try {
      const updateQuery = `UPDATE event_bookings SET status = ? WHERE ${primaryKeyColumn} = ?`;
      const [result] = await db.query(updateQuery, [status, bookingId]);

      if (result.affectedRows > 0) {
        statusUpdated = true;
        console.log(`✅ Status updated to ${status}`);
        
        // Re-fetch the booking to ensure we have the latest data including event_type
        try {
          const [refetchRows] = await db.query(
            `SELECT id, booking_id, customer_name, email, contact_number, 
             special_request, event_type, event_name, event_start_date, event_end_date, 
             status, created_at 
             FROM event_bookings WHERE ${primaryKeyColumn} = ? LIMIT 1`,
            [bookingId]
          );
          if (refetchRows.length > 0) {
            // Update booking object with fresh data
            Object.assign(booking, refetchRows[0]);
            console.log("🔄 Re-fetched booking data:", {
              event_type: booking.event_type,
              event_name: booking.event_name,
            });
          }
        } catch (refetchErr) {
          console.warn("⚠️ Could not re-fetch booking:", refetchErr.message);
        }
      } else {
        console.warn("⚠️ No rows affected by status update");
      }
      
      // If status is being set to 'Confirmed', automatically decline other pending bookings on the same dates
      if (status === 'Confirmed' && statusUpdated) {
        try {
          // Get the booking dates
          const bookingStartDate = booking.event_start_date;
          const bookingEndDate = booking.event_end_date;
          
          if (bookingStartDate && bookingEndDate) {
            // Format dates to ensure proper comparison
            const formatDateForQuery = (dateInput) => {
              if (!dateInput) return null;
              const dateStr = String(dateInput).split('T')[0].split(' ')[0];
              return dateStr;
            };
            
            const formattedStart = formatDateForQuery(bookingStartDate);
            const formattedEnd = formatDateForQuery(bookingEndDate);
            
            console.log("🔍 Checking for conflicting pending bookings on dates:", {
              start: formattedStart,
              end: formattedEnd,
              currentBookingId: bookingId
            });
            
            // Find other pending bookings on the same dates (excluding the current booking)
            const [conflictingBookings] = await db.query(
              `SELECT id, booking_id, customer_name, email, event_start_date, event_end_date 
               FROM event_bookings 
               WHERE ${primaryKeyColumn} != ? 
               AND (status = 'Pending' OR status IS NULL)
               AND DATE(event_start_date) <= DATE(?) 
               AND DATE(event_end_date) >= DATE(?)`,
              [bookingId, formattedEnd, formattedStart]
            );
            
            if (conflictingBookings.length > 0) {
              console.log(`⚠️ Found ${conflictingBookings.length} conflicting pending booking(s) to decline:`, 
                conflictingBookings.map(b => ({ id: b.id || b.booking_id, customer: b.customer_name }))
              );
              
              // Get the primary key column name for the conflicting bookings
              const conflictPrimaryKey = conflictingBookings[0].id ? 'id' : 'booking_id';
              
              // Decline all conflicting bookings
              const conflictIds = conflictingBookings.map(b => b[conflictPrimaryKey] || b.id || b.booking_id);
              const placeholders = conflictIds.map(() => '?').join(',');
              
              const [declineResult] = await db.query(
                `UPDATE event_bookings 
                 SET status = 'Cancelled' 
                 WHERE ${conflictPrimaryKey} IN (${placeholders})`,
                conflictIds
              );
              
              declinedCount = declineResult.affectedRows;
              declinedBookings = conflictingBookings.map(b => ({
                id: b.id || b.booking_id,
                customer: b.customer_name
              }));
              
              console.log(`✅ Automatically declined ${declinedCount} conflicting booking(s)`);
              console.log(`   - Declined booking IDs: ${conflictIds.join(', ')}`);
              console.log(`   - Declined customers: ${conflictingBookings.map(b => b.customer_name).join(', ')}`);
            } else {
              console.log("✅ No conflicting pending bookings found");
            }
          }
        } catch (declineErr) {
          // Log error but don't fail the confirmation
          console.error("⚠️ Error declining conflicting bookings:", declineErr.message);
          console.error("   Confirmation still succeeded, but conflicting bookings were not declined");
        }
      }
    } catch (updateError) {
      // Check if status column doesn't exist
      if (updateError.code === 'ER_BAD_FIELD_ERROR' || 
          updateError.message.includes("Unknown column 'status'") ||
          updateError.message.includes("status")) {
        console.warn("⚠️ Status column doesn't exist. Attempting to add it...");
        try {
          await db.query(
            `ALTER TABLE event_bookings 
             ADD COLUMN status ENUM('Pending', 'Confirmed', 'Cancelled') DEFAULT 'Pending'`
          );
          // Retry the update
          const [result] = await db.query(
            `UPDATE event_bookings SET status = ? WHERE ${primaryKeyColumn} = ?`,
            [status, bookingId]
          );
          if (result.affectedRows > 0) {
            statusUpdated = true;
            console.log(`✅ Status column added and updated to ${status}`);
          }
        } catch (alterError) {
          console.error("⚠️ Could not add status column:", alterError.message);
          // Continue - we'll still try to log the confirmation
        }
      } else {
        console.error("❌ Update error:", updateError.message);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to update event booking status.",
          error: updateError.message,
          code: updateError.code 
        });
      }
    }

    // If status is 'Confirmed', create a log entry in event_reservation_logs
    if (status === 'Confirmed') {
      try {
        // Check if logs table exists
        const [tableCheck] = await db.query(
          "SHOW TABLES LIKE 'event_reservation_logs'"
        );
        
        if (tableCheck.length === 0) {
          console.warn("⚠️ event_reservation_logs table doesn't exist.");
          console.log("💡 To enable logging, run: server/sql/create_event_reservation_logs.sql");
        } else {
          // Insert log entry - support both event_type and event_name columns in logs table
          // Get event_type value, but validate it's not 0, empty string, or null
          let eventTypeValue = null;
          
          // Check event_type first (prioritize it)
          if (booking.event_type && 
              booking.event_type !== '0' && 
              booking.event_type !== 0 && 
              String(booking.event_type).trim() !== '' &&
              String(booking.event_type).trim().toLowerCase() !== 'null') {
            eventTypeValue = String(booking.event_type).trim();
          } 
          // Fallback to event_name if event_type is invalid
          else if (booking.event_name && 
                   booking.event_name !== '0' && 
                   booking.event_name !== 0 && 
                   String(booking.event_name).trim() !== '' &&
                   String(booking.event_name).trim().toLowerCase() !== 'null') {
            eventTypeValue = String(booking.event_name).trim();
          }
          
          console.log("📝 Attempting to log confirmed reservation:", {
            bookingId,
            customer_name: booking.customer_name,
            raw_event_type: booking.event_type,
            raw_event_name: booking.event_name,
            final_event_type: eventTypeValue,
            event_start_date: booking.event_start_date,
            event_end_date: booking.event_end_date,
          });
          
          if (!eventTypeValue) {
            console.warn("⚠️ WARNING: No valid event_type found in booking! Raw values:", {
              event_type: booking.event_type,
              event_name: booking.event_name,
              booking_id: bookingId,
              all_booking_keys: Object.keys(booking)
            });
            
            // Try one more time to fetch event_type directly from database
            try {
              const [typeCheck] = await db.query(
                `SELECT event_type, event_name FROM event_bookings WHERE ${primaryKeyColumn} = ? LIMIT 1`,
                [bookingId]
              );
              if (typeCheck.length > 0) {
                const dbEventType = typeCheck[0].event_type || typeCheck[0].event_name;
                if (dbEventType && dbEventType !== '0' && dbEventType !== 0) {
                  eventTypeValue = String(dbEventType).trim();
                  console.log("✅ Found event_type from direct query:", eventTypeValue);
                }
              }
            } catch (typeErr) {
              console.error("❌ Error checking event_type:", typeErr.message);
            }
          }
          
          // Final check - if still no event_type, log a critical warning but continue
          if (!eventTypeValue) {
            console.error("❌ CRITICAL: Cannot log event_type - it's missing from booking!");
            console.error("   This reservation will be logged WITHOUT event_type.");
            console.error("   Booking ID:", bookingId);
            console.error("   Customer:", booking.customer_name);
          }
          
          // Helper function to format date to avoid timezone issues
          // Converts date to YYYY-MM-DD HH:MM:SS format using local time
          const formatDateTime = (dateInput) => {
            if (!dateInput) return null;
            
            try {
              let date;
              if (typeof dateInput === 'string') {
                // Handle YYYY-MM-DD format - parse manually to avoid timezone issues
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                  const [year, month, day] = dateInput.split('-').map(Number);
                  // Create date using local time constructor to avoid timezone shifts
                  date = new Date(year, month - 1, day, 0, 0, 0);
                } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dateInput)) {
                  // Handle YYYY-MM-DD HH:MM:SS format
                  const [datePart, timePart] = dateInput.split(' ');
                  const [year, month, day] = datePart.split('-').map(Number);
                  const [hours, minutes, seconds] = timePart.split(':').map(Number);
                  date = new Date(year, month - 1, day, hours, minutes, seconds);
                } else {
                  // Try to parse as-is
                  date = new Date(dateInput);
                }
              } else if (dateInput instanceof Date) {
                date = dateInput;
              } else {
                date = new Date(dateInput);
              }
              
              if (isNaN(date.getTime())) {
                console.warn("Invalid date:", dateInput);
                return null;
              }
              
              // Use local date components to avoid timezone shifts
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              const seconds = String(date.getSeconds()).padStart(2, '0');
              
              return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            } catch (e) {
              console.warn("Could not parse date:", dateInput, e);
              return null;
            }
          };
          
          // Format dates to avoid timezone issues
          const formattedStartDate = formatDateTime(booking.event_start_date);
          const formattedEndDate = formatDateTime(booking.event_end_date);
          const confirmedAt = new Date();
          const confirmedAtFormatted = formatDateTime(confirmedAt);
          
          console.log("📅 Date formatting:", {
            original_start: booking.event_start_date,
            formatted_start: formattedStartDate,
            original_end: booking.event_end_date,
            formatted_end: formattedEndDate,
          });
          
          // Build INSERT query matching the actual schema
          // Schema: log_id, event_type, customer_name, email, contact_number, 
          //         special_request, event_start_date, event_end_date, confirmed_at, confirmed_by, status
          const insertQuery = `INSERT INTO event_reservation_logs 
            (event_type, customer_name, email, contact_number, special_request, 
             event_start_date, event_end_date, confirmed_at, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          
          // Validate required fields - if missing, skip logging but don't fail confirmation
          if (!formattedStartDate || !formattedEndDate) {
            console.error("❌ Missing required dates for logging:", {
              formattedStartDate,
              formattedEndDate,
              original_start: booking.event_start_date,
              original_end: booking.event_end_date
            });
            console.warn("⚠️ Skipping log entry due to missing dates, but confirmation will still succeed");
            // Don't throw - just skip logging
          } else {
            const insertParams = [
              eventTypeValue || null, // Allow null for event_type
              (booking.customer_name || '').substring(0, 100), // Ensure it fits varchar(100)
              (booking.email || '').substring(0, 100), // Ensure it fits varchar(100)
              (booking.contact_number || '').substring(0, 20), // Ensure it fits varchar(20)
              booking.special_request || null,
              formattedStartDate,
              formattedEndDate,
              confirmedAtFormatted,
              'Confirmed'
            ];
            
            try {
            
            console.log("📤 Executing INSERT query:", insertQuery);
            console.log("📤 With params:", insertParams);
            
            const [insertResult] = await db.query(insertQuery, insertParams);
            console.log("✅ Event reservation logged successfully!");
            console.log("   - Log ID:", insertResult.insertId);
            console.log("   - Event Type:", eventTypeValue);
            console.log("   - Start Date:", formattedStartDate);
            console.log("   - End Date:", formattedEndDate);
            
            // Verify the log was created
            const [verifyLog] = await db.query(
              "SELECT * FROM event_reservation_logs WHERE log_id = ?",
              [insertResult.insertId]
            );
            if (verifyLog.length > 0) {
              console.log("✅ Verification - Log entry created:", {
                log_id: verifyLog[0].log_id,
                customer_name: verifyLog[0].customer_name,
                event_type: verifyLog[0].event_type || 'N/A',
                event_start_date: verifyLog[0].event_start_date,
                event_end_date: verifyLog[0].event_end_date,
              });
            }
          } catch (logError) {
            console.error("❌ Error inserting into event_reservation_logs:");
            console.error("   Error message:", logError.message);
            console.error("   Error code:", logError.code);
            console.error("   SQL:", logError.sql);
            // Don't re-throw - let outer catch handle it gracefully
            // This allows confirmation to succeed even if logging fails
          }
          }
        }
      } catch (logError) {
        // Log the error but don't fail the request if logging fails
        console.error("❌ CRITICAL: Failed to create log entry!");
        console.error("   Error message:", logError.message);
        console.error("   Error code:", logError.code || 'UNKNOWN');
        console.error("   SQL:", logError.sql || 'N/A');
        console.error("   Full error:", JSON.stringify(logError, null, 2));
        // Note: We continue - the reservation status update still succeeds
        // But we should investigate why logging failed
        // The confirmation will still be successful even if logging fails
      }
    }

    // Return success even if status column didn't exist (as long as we found the booking)
    let message = statusUpdated 
      ? "Event booking status updated successfully." 
      : "Event booking found. (Status column may not exist - confirmation logged)";
    
    // Add information about declined bookings if any
    if (status === 'Confirmed' && declinedCount > 0) {
      message += ` ${declinedCount} conflicting pending booking(s) were automatically declined.`;
    }
    
    res.json({ 
      success: true, 
      message: message,
      statusUpdated,
      declinedCount: declinedCount || 0,
      declinedBookings: declinedBookings || []
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({ 
      success: false, 
      message: "An unexpected error occurred.",
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// 404 handler for this router - return JSON instead of HTML
router.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false, 
    message: `Route not found: ${req.method} ${req.path}` 
  });
});

// Error handler for this router
router.use((err, req, res, next) => {
  console.error("❌ Router Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "An error occurred",
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default router;
