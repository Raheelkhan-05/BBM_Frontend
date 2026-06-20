import {BrowserRouter, Routes, Route} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleProtectedRoute from "./routes/RoleProtectedRoute";
import Navbar from "./shared/Navbar";
import Users from "./pages/Users";
import Leads from "./pages/Leads";
import RFQs from "./pages/RFQs";
import Products from "./pages/Products";
import RoutesPage from "./pages/RoutesPage";
import Samples    from "./pages/Samples";
import Quotations from "./pages/Quotations";
import Prospects from "./pages/Prospects";


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

    <Route path="/prospects" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><Prospects /></RoleProtectedRoute>} />
    <Route path="/leads" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><Leads /></RoleProtectedRoute>} />
    <Route path="/enquiries" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><RFQs /></RoleProtectedRoute>} />
    <Route path="/routes" element={<RoleProtectedRoute allowedRoles={["Admin", "Salesperson"]}><RoutesPage /></RoleProtectedRoute>} />
    <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
    <Route path="/samples" element={<RoleProtectedRoute allowedRoles={["Admin", "SalesCoordinator"]}><Samples /></RoleProtectedRoute>} />
    <Route path="/quotations" element={<RoleProtectedRoute allowedRoles={["Admin", "SalesCoordinator"]}><Quotations /></RoleProtectedRoute>} />


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