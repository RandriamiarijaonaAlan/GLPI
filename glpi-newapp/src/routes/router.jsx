import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import Home from '../pages/Home';
import BackofficeLogin from '../pages/BackofficeLogin';
import Dashboard from '../pages/Dashboard';
import ImportFiles from '../pages/ImportFiles';
import ResetData from '../pages/ResetData';
import Tickets from '../pages/Tickets';
import TicketDetail from '../pages/TicketDetail';
import ElementsList from '../pages/ElementsList';
import CreateTicket from '../pages/CreateTicket';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/admin/login',
    element: <BackofficeLogin />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/admin/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/admin/import',
        element: <ImportFiles />,
      },
      {
        path: '/admin/reset',
        element: <ResetData />,
      },
      {
        path: '/admin/tickets',
        element: <Tickets />,
      },
      {
        path: '/admin/tickets/:id',
        element: <TicketDetail />,
      },
    ],
  },
  {
    path: '/front/elements',
    element: <ElementsList />,
  },
  {
    path: '/front/create-ticket',
    element: <CreateTicket />,
  },
]);

export default router;
