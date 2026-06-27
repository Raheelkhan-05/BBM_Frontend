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
import ProspectsNew from "./pages/prospects/index";
import FollowupsDue from "./pages/FollowupsDue";


function App() {

 return (
  <BrowserRouter>
   <Navbar /> 
   <Routes>
    <Route
     path="/"
     element={<Login />}
    />

    <Route
     path="/signup"
     element={<Signup />}
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

    <Route path="/prospects" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><ProspectsNew /></RoleProtectedRoute>} />
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