import {BrowserRouter, Routes, Route} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleProtectedRoute from "./routes/RoleProtectedRoute";
import Navbar from "./shared/Navbar";
import Users from "./pages/Users";
import Products from "./pages/Products";
import RoutesPage from "./pages/RoutesPage";
import Pipeline from "./pages/prospects/Pipeline";
import FollowupsDue from "./pages/FollowupsDue";
import PublicRoute from "./routes/PublicRoute";


function App() {

 return (
  <BrowserRouter>
   <Navbar /> 
   <Routes>
    <Route
      path="/"
      element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      }
    />

    <Route
      path="/signup"
      element={
        <PublicRoute>
          <Signup />
        </PublicRoute>
      }
    />

    <Route
     path="/dashboard"
     element={
      <ProtectedRoute>
       <Dashboard />
      </ProtectedRoute>
     }
    />
    <Route
     path="/followups"
     element={
      <ProtectedRoute>
       <FollowupsDue />
      </ProtectedRoute>
     }
    />

    <Route path="/prospects" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><Pipeline /></RoleProtectedRoute>} />
    {/* <Route path="/prospects" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><Prospects /></RoleProtectedRoute>} /> */}
    <Route path="/routes" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><RoutesPage /></RoleProtectedRoute>} />
    <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />

    {/* ONLY ADMIN */}
    <Route
      path="/users"
      element={
        <RoleProtectedRoute allowedRoles={["Admin"]}>
          <Users />
        </RoleProtectedRoute>
      }
    />

   </Routes>
  </BrowserRouter>

 );
}

export default App;