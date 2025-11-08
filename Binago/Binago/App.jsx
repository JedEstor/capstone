import React, { useEffect } from 'react'
import Navbar from './components/Navbar'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Footer from './components/Footer'
import AllRooms from './pages/AllRooms'
import RoomDetails from './pages/RoomDetails'
import MyBookings from './pages/MyBookings'
import Layout from './pages/hotelOwner/Layout'
import Dashboard from './pages/hotelOwner/Dashboard'
import AddRoom from './pages/hotelOwner/AddRoom'
import ListRoom from './pages/hotelOwner/ListRoom'
import Events from './pages/Events'
import Dining from './pages/Dining'
import AddEvent from './pages/hotelOwner/AddEvent'
import About from './pages/About'
import { Toaster } from 'react-hot-toast'
import HotelReg from './components/HotelReg'
import { useAppContext } from './context/AppContext'
import LoginForm from './pages/LoginForm'
import FaqButton from './components/FaqButton'
import Offers from './pages/Offers'
import Booking_logs from './pages/hotelOwner/Booking_logs'
import Guests from './pages/hotelOwner/Guests'
import Bookings from './pages/hotelOwner/Bookings'
import EventReservations from './pages/hotelOwner/EventReservations'
import EventReservationsLogs from './pages/hotelOwner/EventReservationsLogs' // ✅ Added import
import RequireOwner from './routes/RequireOwner'

const App = () => {
  const location = useLocation();
  const isOwnerPath = location.pathname.includes("owner");
  const { showHotelReg } = useAppContext();

  return (
    <div>
      <Toaster />
      {!isOwnerPath && <Navbar />}
      {showHotelReg && <HotelReg />} 

      <div className='min-h-[70vh]'>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/accommodation' element={<AllRooms />} />
          <Route path='/events' element={<Events />} />
          <Route path='/dining' element={<Dining />} />
          <Route path='/about' element={<About />} />
          <Route path='/offers' element={<Offers />} />
          <Route path='/login' element={<LoginForm />} />
          <Route path='/rooms/:id' element={<RoomDetails />} />
          <Route path='/my-bookings' element={<MyBookings />} />

          <Route path='/owner' element={<RequireOwner><Layout /></RequireOwner>}>
            <Route index element={<Dashboard />} />
            <Route path='add-room' element={<AddRoom />} />
            <Route path='list-room' element={<ListRoom />} />
            <Route path='add-event' element={<AddEvent />} />
            <Route path='booking-logs' element={<Booking_logs />} />
            <Route path='guest' element={<Guests />} />
            <Route path='bookings' element={<Bookings />} />
            <Route path='event-reservations' element={<EventReservations />} />
            <Route path='event-reservations-logs' element={<EventReservationsLogs />} /> {/* ✅ Added route */}
          </Route>
        </Routes>
      </div>

      {!isOwnerPath && <Footer />}
      <FaqButton />
    </div>
  )
}

export default App
