import { GuidedTour as SharedGuidedTour, tourHighlightClass } from '../../../shared/components/GuidedTour';

export const initialFormState = {
  cliente_id: '',
  equipo_id: '',
  falla_reportada: '',
  prioridad: 'Normal',
  estado: 'INGRESADO',
  deja_cargador: false,
  enciende: false,
  usa_corriente_ac: false,
  estado_cargador: 'NO_VERIFICADO',
  estado_accesorios: 'NO_VERIFICADOS',
  estado_fisico: 'NO_VERIFICADO',
  estado_encendido: 'NO_PROBADO',
  estado_alimentacion: 'NO_PROBADA',
  estado_acceso: 'NO_VERIFICADO',
  detalle_accesorios: '',
  observaciones_recepcion: '',
};

export const tourSteps = [
  {
    target: 'header',
    title: '1. Diagnostico de ingreso',
    text: 'Esta pantalla registra la revision inicial del equipo que trae el cliente. Si vienes desde Equipos, cliente y equipo ya quedan seleccionados.',
  },
  {
    target: 'owner',
    title: '2. Cliente y contacto',
    text: 'Selecciona el cliente y confirma telefono e ID. Esto evita generar un diagnostico para la persona equivocada.',
  },
  {
    target: 'equipment',
    title: '3. Equipo correcto',
    text: 'El selector muestra solo los equipos del cliente elegido. Al seleccionar uno, el tipo se muestra automaticamente como verificacion.',
  },
  {
    target: 'priority',
    title: '4. Prioridad y accesorios',
    text: 'Seleccione la prioridad y revise solo los datos aplicables al tipo de equipo. Monitores, impresoras y UPS no solicitan cargador; los cables o adaptadores se describen en accesorios. Los nombres de los equipos registrados se conservan.',
  },
  {
    target: 'failure',
    title: '5. Falla reportada',
    text: 'Este campo es obligatorio. Si intentas guardar sin escribir la falla, el sistema muestra una alerta y bloquea el guardado.',
  },
  {
    target: 'actions',
    title: '6. Guardar diagnostico',
    text: 'Generar Diagnostico de Ingreso crea el registro. En modo edicion, el boton guarda cambios y Cancelar descarta la edicion.',
  },
  {
    target: 'table',
    title: '7. Revisar registros',
    text: 'La tabla tiene scroll interno y encabezado fijo para trabajar mejor con muchas filas o pantallas pequenas.',
  },
  {
    target: 'table',
    title: '8. Editar diagnosticos',
    text: 'Usa el boton de lapiz en una fila para cargar ese diagnostico en el formulario superior. Si ya tiene tecnico asignado, no podra editarse.',
  },
];

export { tourHighlightClass };

export const GuidedTour = (props) => <SharedGuidedTour steps={tourSteps} {...props} />;
