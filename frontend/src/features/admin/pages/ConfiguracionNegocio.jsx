import { AdminPage } from '../components/AdministrationUI';
import PageHelp from '../../../components/PageHelp';
import ConfigurationEditor from '../components/ConfigurationEditor';

export default function ConfiguracionNegocio() {
  return <AdminPage title="Configuración del negocio" description="Define los datos del taller y los valores iniciales de nuevas operaciones." actions={<PageHelp compact />}><ConfigurationEditor /></AdminPage>;
}
