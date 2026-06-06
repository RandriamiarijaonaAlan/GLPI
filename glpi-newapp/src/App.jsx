import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import RouteProtegeeBackoffice from './backoffice/routes/RouteProtegeeBackoffice';
import ConnexionBackoffice from './backoffice/pages/ConnexionBackoffice';
import TableauDeBord from './backoffice/pages/TableauDeBord';
import TicketsBackoffice from './backoffice/pages/TicketsBackoffice';
import FicheTicketBackoffice from './backoffice/pages/FicheTicketBackoffice';
import ImportFichiers from './backoffice/pages/ImportFichiers';
import ReinitialisationDonnees from './backoffice/pages/ReinitialisationDonnees';
import Accueil from './frontoffice/pages/Accueil';
import ListeElements from './frontoffice/pages/ListeElements';
import CreationTicket from './frontoffice/pages/CreationTicket';

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
      element: <RouteProtegeeBackoffice />,
      children: [
        {
          path: '/admin/dashboard',
          element: <TableauDeBord />,
        },
        {
          path: '/admin/tickets',
          element: <TicketsBackoffice />,
        },
        {
          path: '/admin/tickets/:id',
          element: <FicheTicketBackoffice />,
        },
        {
          path: '/admin/import',
          element: <ImportFichiers />,
        },
        {
          path: '/admin/reset',
          element: <ReinitialisationDonnees />,
        },
      ],
    },
    {
      path: '/front/elements',
      element: <ListeElements />,
    },
    {
      path: '/front/create-ticket',
      element: <CreationTicket />,
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
