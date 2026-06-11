import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import RouteProtegeeBackoffice from './backoffice/routes/RouteProtegeeBackoffice';
import LayoutBackoffice from './backoffice/composants/LayoutBackoffice';
import ConnexionBackoffice from './backoffice/pages/ConnexionBackoffice';
import TableauDeBord from './backoffice/pages/TableauDeBord';
import TicketsBackoffice from './backoffice/pages/TicketsBackoffice';
import FicheTicketBackoffice from './backoffice/pages/FicheTicketBackoffice';
import ImportFichiers from './backoffice/pages/ImportFichiers';
import ReinitialisationDonnees from './backoffice/pages/ReinitialisationDonnees';
import Accueil from './frontoffice/pages/Accueil';
import LayoutFrontoffice from './frontoffice/components/LayoutFrontoffice';
import ListeElements from './frontoffice/pages/ListeElements';
import CreationTicket from './frontoffice/pages/CreationTicket';
import ConfigurationKanban from './backoffice/pages/ConfigurationKanban';
import KanbanTickets from './frontoffice/pages/KanbanTicket';

const routeur = createBrowserRouter(
  [
    {
      path: '/',
      element: <Accueil />,
    },
    {
      path: '/admin/login',
      element: <ConnexionBackoffice />,
    },
    {
      path: '/admin',
      element: <RouteProtegeeBackoffice />,
      children: [
        {
          element: <LayoutBackoffice />,
          children: [
            {
              index: true,
              element: <Navigate to="/admin/dashboard" replace />,
            },
            {
              path: 'dashboard',
              element: <TableauDeBord />,
            },
            {
              path: 'tickets',
              element: <TicketsBackoffice />,
            },
            {
              path: 'tickets/:id',
              element: <FicheTicketBackoffice />,
            },
            {
              path: 'import',
              element: <ImportFichiers />,
            },
            {
              path: 'reset',
              element: <ReinitialisationDonnees />,
            },
            {
              path:'kanban-config',
              element: <ConfigurationKanban />,
            }
          ],
        },
      ],
    },
    {
      path: '/front',
      element: <LayoutFrontoffice />,
      children: [
        {
          index: true,
          element: <Navigate to="/front/elements" replace />,
        },
        {
          path: 'elements',
          element: <ListeElements />,
        },
        {
          path: 'create-ticket',
          element: <CreationTicket />,
        },
        {
          path: 'kanban',
          element: <KanbanTickets />,
        },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  },
);

export default function App() {
  return <RouterProvider router={routeur} />;
}
