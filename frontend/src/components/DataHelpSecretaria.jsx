// Frontend/src/components/shared/DataHelpSecretaria.jsx

export const defaultHelp = {
  title: 'Mini tutorial',
  description:
    'Usa esta pantalla para consultar, filtrar y dar seguimiento a la información del módulo.',
  steps: [
    [
      '1. Revisa el resumen',
      'Observa los contadores o tablas principales antes de hacer cambios.',
    ],
    [
      '2. Busca o filtra',
      'Usa los filtros, buscadores o columnas para encontrar el registro correcto.',
    ],
    [
      '3. Abre el detalle',
      'Entra al registro que necesitas revisar, editar o exportar.',
    ],
    [
      '4. Confirma cambios',
      'Guarda solo cuando la información esté completa y revisada.',
    ],
  ],
};

const facturacionHelp = {
  title: 'Mini tutorial de facturación',
  description: 'Consulta facturas emitidas y control de cobros.',
  steps: [
    [
      '1. Busca factura',
      'Filtra por cliente, orden o fecha de emisión.',
    ],
    [
      '2. Revisa montos',
      'Confirma repuestos, mano de obra, impuestos y total.',
    ],
    [
      '3. Verifica garantía',
      'Comprueba si la factura ya tiene garantía asociada.',
    ],
    [
      '4. Exporta o audita',
      'Usa la información para reportes y seguimiento administrativo.',
    ],
  ],
};

const flujoAtencionHelp = {
  title: 'Mini tutorial de flujo de atención',
  description: 'Sigue cada equipo desde ingreso hasta garantía.',
  steps: [
    [
      '1. Usa filtros',
      'Cambia entre pendientes, revisión, reparación, facturación y garantía.',
    ],
    [
      '2. Busca rápido',
      'Filtra por cliente, equipo, serie, orden o factura.',
    ],
    [
      '3. Lee la línea',
      'Cada tarjeta muestra cliente, equipo, diagnóstico, orden y postventa.',
    ],
    [
      '4. Decide el siguiente paso',
      'Abre el módulo correspondiente para avanzar el caso.',
    ],
  ],
};

export const helpByPath = {
  '/admin/administracion': {
    title: 'Administración del taller',
    description: 'Centraliza la cuenta, los accesos y la configuración del negocio.',
    steps: [
      ['1. Elige un apartado', 'Abre cuenta, usuarios, negocio, reglas, respaldos o auditoría.'],
      ['2. Revisa los valores', 'Consulta la configuración actual antes de editar.'],
      ['3. Guarda con un motivo', 'Los ajustes del negocio y las reglas quedan registrados con su autor.'],
    ],
  },
  '/admin/mi-cuenta': {
    title: 'Mi cuenta',
    description: 'Administra tu usuario, correo y contraseña.',
    steps: [
      ['1. Actualiza el perfil', 'Introduce tu contraseña actual para guardar usuario y correo.'],
      ['2. Cambia la contraseña', 'Confirma la nueva contraseña y cumple el mínimo indicado.'],
      ['3. Revisa las sesiones', 'Cambiar la contraseña o cerrar todas las sesiones requiere iniciar sesión otra vez.'],
    ],
  },
  '/admin/configuracion': {
    title: 'Datos del negocio',
    description: 'Configura los datos del taller y los valores para nuevas garantías y repuestos.',
    steps: [
      ['1. Revisa el negocio', 'Completa nombre, contacto y dirección.'],
      ['2. Ajusta los valores', 'Las nuevas garantías usan los meses y condiciones; los nuevos repuestos usan el margen inicial.'],
      ['3. Explica el cambio', 'Escribe el motivo y guarda. Si otra persona guardó antes, recarga la configuración.'],
    ],
  },
  '/admin/reglas': {
    title: 'Reglas del negocio',
    description: 'Ajusta avisos y plazos, y consulta los requisitos de cada módulo.',
    steps: [
      ['1. Configura avisos', 'Define días para garantías por vencer y órdenes atrasadas.'],
      ['2. Revisa las contraseñas', 'El mínimo configurado se aplica a nuevas contraseñas.'],
      ['3. Consulta los requisitos', 'Los estados, permisos y requisitos operativos explican cuándo se permite cada acción.'],
    ],
  },
  '/admin/respaldos': {
    title: 'Respaldos de la base de datos',
    description: 'Crea, descarga y programa copias del taller.',
    steps: [
      ['1. Revisa el estado', 'Comprueba la última copia completa y la próxima ejecución.'],
      ['2. Crea o descarga', 'Una copia parcial no sustituye una copia completa. Descarga los archivos que necesites.'],
      ['3. Programa las copias', 'Elige frecuencia y hora de Nicaragua. El servidor debe estar activo.'],
      ['4. Verifica los archivos', 'La comprobación revisa integridad y estructura. Las fotografías necesitan una copia independiente.'],
    ],
  },
  '/admin/auditoria': {
    title: 'Auditoría',
    description: 'Consulta quién cambió los datos y cuándo ocurrió.',
    steps: [
      ['1. Filtra movimientos', 'Selecciona fechas, módulo, operación o autor.'],
      ['2. Abre el detalle', 'Compara los datos anteriores y nuevos, y revisa el motivo cuando exista.'],
      ['3. Revisa más resultados', 'Usa la paginación para recorrer los movimientos.'],
    ],
  },
  '/admin/reportes': {
    title: 'Centro de reportes',
    description: 'Encuentra los 35 reportes agrupados por categoría.',
    steps: [
      ['1. Selecciona el reporte', 'Elige la categoría y después una opción del selector.'],
      ['2. Aplica filtros', 'Selecciona fechas, estado o registros y pulsa Consultar reporte. Finanzas usa el año actual por defecto.'],
      ['3. Descarga los resultados', 'Excel y PDF incluyen todos los registros del filtro aplicado.'],
    ],
  },
  '/admin': {
    title: 'Mini tutorial de administración',
    description:
      'Usa este panel para ver indicadores generales, productividad, garantías y accesos rápidos.',
    steps: [
      [
        '1. Revisa indicadores',
        'Las tarjetas superiores resumen equipos, órdenes, facturas, usuarios y diagnósticos.',
      ],
      [
        '2. Lee productividad',
        'Los gráficos comparan diagnósticos y órdenes cerradas por período.',
      ],
      [
        '3. Supervisa tablas',
        'Órdenes recientes, equipos y garantías ayudan a detectar pendientes.',
      ],
      [
        '4. Entra al módulo',
        'Usa accesos rápidos para administrar usuarios, equipos, órdenes y repuestos.',
      ],
    ],
  },

  '/secretaria': {
    title: 'Mini tutorial de Secretaría',
    description:
      'Usa este panel como punto de entrada para registrar clientes, equipos, diagnósticos, órdenes y facturas.',
    steps: [
      [
        '1. Revisa el período',
        'Cambia entre todo, semana, mes o año para ver actividad reciente.',
      ],
      [
        '2. Entra al módulo',
        'Las tarjetas abren clientes, equipos, diagnósticos, órdenes y facturación.',
      ],
      [
        '3. Atiende órdenes',
        'La tabla inferior muestra las órdenes más recientes para dar seguimiento.',
      ],
      [
        '4. Usa flujo atención',
        'Cuando necesites contexto completo, abre el tablero de seguimiento.',
      ],
    ],
  },

  '/admin/equipos': {
    title: 'Mini tutorial de equipos',
    description:
      'Consulta, filtra y actualiza equipos registrados en taller.',
    steps: [
      [
        '1. Busca equipo',
        'Filtra por cliente, marca, modelo, tipo o número de serie.',
      ],
      [
        '2. Revisa diagnóstico',
        'Verifica el último estado técnico asociado al equipo.',
      ],
      [
        '3. Edita datos',
        'Corrige cliente, tipo, marca, modelo o serie cuando haga falta.',
      ],
      [
        '4. Abre historial',
        'Usa historial para ver diagnósticos, órdenes, facturas y garantías.',
      ],
    ],
  },

  '/admin/usuarios': {
    title: 'Mini tutorial de usuarios',
    description:
      'Administra cuentas, roles y acceso al sistema.',
    steps: [
      [
        '1. Revisa usuarios',
        'Verifica nombre, rol y estado antes de editar una cuenta.',
      ],
      [
        '2. Crea con rol correcto',
        'Asigna Administrador, Secretaría, Técnico o TécnicoJefe según corresponda.',
      ],
      [
        '3. Actualiza datos',
        'Usa editar para corregir correo, rol o estado de acceso.',
      ],
      [
        '4. Protege credenciales',
        'Cambia contraseñas solo cuando sea necesario y confirma con el usuario.',
      ],
    ],
  },

  '/admin/clientes': {
    title: 'Mini tutorial de clientes',
    description:
      'Consulta clientes y su información operativa desde administración.',
    steps: [
      [
        '1. Busca el cliente',
        'Filtra por nombre, teléfono o correo para ubicarlo rápido.',
      ],
      [
        '2. Revisa equipos',
        'Confirma que sus equipos estén correctamente asociados.',
      ],
      [
        '3. Valida contacto',
        'Teléfono y correo ayudan a evitar órdenes mal vinculadas.',
      ],
      [
        '4. Sigue historial',
        'Usa los módulos de equipos u órdenes para ver el estado del servicio.',
      ],
    ],
  },

  '/admin/ordenes': {
    title: 'Mini tutorial de órdenes',
    description:
      'Supervisa y actualiza las órdenes de trabajo del taller.',
    steps: [
      [
        '1. Lee el estado',
        'Identifica si la orden está pendiente, en reparación o finalizada.',
      ],
      [
        '2. Abre detalle',
        'Usa Ver / Editar para revisar cliente, equipo y repuestos.',
      ],
      [
        '3. Asigna técnico',
        'Selecciona el técnico encargado cuando corresponda.',
      ],
      [
        '4. Exporta repuestos',
        'Descarga Excel si necesitas revisar materiales de una orden.',
      ],
    ],
  },

  '/admin/repuestos': {
    title: 'Mini tutorial de repuestos',
    description:
      'Controla inventario, costos y disponibilidad de piezas.',
    steps: [
      [
        '1. Revisa stock',
        'Prioriza piezas con bajo inventario o solicitudes pendientes.',
      ],
      [
        '2. Valida costo',
        'Confirma costo y ganancia antes de usar el repuesto en facturación.',
      ],
      [
        '3. Actualiza estado',
        'Marca piezas descontinuadas cuando ya no se deben vender.',
      ],
      [
        '4. Consulta historial',
        'Usa historial para entender compras y uso del repuesto.',
      ],
    ],
  },

  '/admin/compras': {
    title: 'Mini tutorial de compras',
    description:
      'Da seguimiento a compras y entradas de inventario.',
    steps: [
      [
        '1. Revisa proveedor',
        'Confirma que la compra esté asociada al proveedor correcto.',
      ],
      [
        '2. Valida cantidad',
        'La cantidad comprada impacta el stock disponible.',
      ],
      [
        '3. Confirma costo',
        'El costo unitario alimenta cálculos de ganancia.',
      ],
      [
        '4. Usa reportes',
        'Compara compras recientes cuando revises inventario.',
      ],
    ],
  },

  '/admin/ganancias': {
    title: 'Mini tutorial de ganancias',
    description:
      'Analiza ingresos, costos, rentabilidad, activos y exportaciones financieras por período.',
    steps: [
      [
        '1. Define el período',
        'Usa Semana, Mes, Trimestre, Año o un rango manual.',
      ],
      [
        '2. Consulta el reporte',
        'Cambia el límite de detalle y presiona Consultar.',
      ],
      [
        '3. Lee las tarjetas',
        'Ingresos, compras de inventario, pérdidas reales, ganancia neta y margen.',
      ],
      [
        '4. Cambia la etapa',
        'En Balance por etapa alterna Semanal, Mensual o Anual.',
      ],
      [
        '5. Revisa secciones',
        'Margen por orden, control de activos, costos y pérdidas.',
      ],
      [
        '6. Exporta evidencia',
        'Cada bloque con exportación permite descargar Excel o PDF.',
      ],
    ],
  },

  '/admin/tecnicos': {
    title: 'Mini tutorial de técnicos',
    description:
      'Mide productividad y carga de trabajo del equipo técnico.',
    steps: [
      [
        '1. Compara métricas',
        'Revisa diagnósticos, órdenes cerradas y tiempos.',
      ],
      [
        '2. Detecta atrasos',
        'Ubica técnicos con carga alta o trabajos demorados.',
      ],
      [
        '3. Reasigna trabajo',
        'Usa el panel de jefe técnico si hace falta balancear.',
      ],
      [
        '4. Evalúa tendencia',
        'Observa rendimiento mensual antes de tomar decisiones.',
      ],
    ],
  },

  '/admin/inventario': {
    title: 'Mini tutorial de inventario',
    description:
      'Consulta existencias y disponibilidad de piezas.',
    steps: [
      [
        '1. Revisa stock actual',
        'Identifica piezas disponibles y agotadas.',
      ],
      [
        '2. Filtra por categoría',
        'Agrupa repuestos por tipo para encontrar más rápido.',
      ],
      [
        '3. Valida proveedor',
        'Confirma origen antes de volver a comprar.',
      ],
      [
        '4. Coordina compras',
        'Registra compras para mantener inventario actualizado.',
      ],
    ],
  },

  '/admin/visualizacion-control-facturas': facturacionHelp,
  '/admin/facturacion': facturacionHelp,
  '/secretaria/facturacion': facturacionHelp,

  '/admin/ordenes-estado': {
    title: 'Mini tutorial de estado de órdenes',
    description:
      'Visualiza el avance operativo de las órdenes.',
    steps: [
      [
        '1. Agrupa por estado',
        'Distingue pendientes, reparación, finalizadas y entregadas.',
      ],
      [
        '2. Detecta bloqueos',
        'Busca órdenes detenidas por repuestos o aprobaciones.',
      ],
      [
        '3. Abre detalle',
        'Consulta técnico, cliente y equipo de cada orden.',
      ],
      [
        '4. Da seguimiento',
        'Actualiza desde el módulo de órdenes cuando haga falta.',
      ],
    ],
  },

  '/admin/diagnosticos': {
    title: 'Mini tutorial de diagnósticos',
    description:
      'Monitorea diagnósticos por estado y aprobación.',
    steps: [
      [
        '1. Revisa pendientes',
        'Identifica equipos que aún necesitan diagnóstico.',
      ],
      [
        '2. Valida completados',
        'Confirma informe técnico y presupuesto.',
      ],
      [
        '3. Cambia estado',
        'Actualiza solo cuando el diagnóstico esté listo.',
      ],
      [
        '4. Crea orden',
        'Los diagnósticos completados pueden pasar a orden de reparación.',
      ],
    ],
  },

  '/admin/garantias': {
    title: 'Mini tutorial de garantías',
    description:
      'Controla garantías activas, vencimientos y renovaciones.',
    steps: [
      [
        '1. Revisa vencimientos',
        'Prioriza garantías próximas a vencer.',
      ],
      [
        '2. Consulta factura',
        'Cada garantía debe estar asociada a una factura.',
      ],
      [
        '3. Edita condiciones',
        'Aclara cobertura y duración cuando sea necesario.',
      ],
      [
        '4. Renueva con criterio',
        'Renueva solo si corresponde por política del taller.',
      ],
    ],
  },

  '/admin/historial-equipo': {
    title: 'Mini tutorial de historial de equipo',
    description:
      'Consulta el recorrido completo de un equipo.',
    steps: [
      [
        '1. Busca equipo',
        'Usa cliente, serie, marca o modelo para localizarlo.',
      ],
      [
        '2. Revisa diagnósticos',
        'Mira fallas reportadas y resultados técnicos.',
      ],
      [
        '3. Sigue órdenes',
        'Consulta reparaciones y estados anteriores.',
      ],
      [
        '4. Verifica postventa',
        'Revisa facturas y garantías vinculadas.',
      ],
    ],
  },

  '/admin/historial-repuesto': {
    title: 'Mini tutorial de historial de repuesto',
    description:
      'Consulta movimientos y uso de una pieza.',
    steps: [
      [
        '1. Busca repuesto',
        'Filtra por nombre, categoría o proveedor.',
      ],
      [
        '2. Revisa compras',
        'Confirma entradas, costos y fechas.',
      ],
      [
        '3. Revisa uso',
        'Identifica en qué órdenes se usó la pieza.',
      ],
      [
        '4. Ajusta compras',
        'Usa el historial para planificar reposición.',
      ],
    ],
  },

  '/secretaria/flujo-atencion': flujoAtencionHelp,
  '/admin/flujo-atencion': flujoAtencionHelp,

  '/tecnico': {
    title: 'Mini tutorial del técnico',
    description:
      'Este panel ordena tu trabajo diario: revisar diagnósticos, mover órdenes y solicitar repuestos.',
    steps: [
      [
        '1. Filtra indicadores',
        'El selector de fecha cambia los cuatro contadores superiores.',
      ],
      [
        '2. Trabaja por pestañas',
        'Usa diagnósticos, órdenes activas, finalizadas y piezas según la tarea.',
      ],
      [
        '3. Busca rápido',
        'Cada sección tiene buscador para filtrar por cliente, equipo, falla u orden.',
      ],
      [
        '4. Cierra con cuidado',
        'Al finalizar una orden se abre el formulario de cierre técnico.',
      ],
    ],
  },

  '/tecnico-jefe': {
    title: 'Mini tutorial del jefe técnico',
    description:
      'Administra asignaciones, disponibilidad, prioridades y solicitudes. Consulta el seguimiento y registra las excepciones con motivo.',
    steps: [
      [
        '1. Revisa pendientes',
        'Las tarjetas muestran diagnósticos, órdenes, repuestos y alertas abiertas.',
      ],
      [
        '2. Asigna técnicos',
        'En Asignaciones distribuye trabajos entre técnicos disponibles. Cada técnico registra su inicio real.',
      ],
      [
        '3. Aprueba repuestos',
        'Aprueba o rechaza las solicitudes. La entrega física de las piezas aprobadas se confirma por separado.',
      ],
      [
        '4. Supervisa e interviene',
        'Consulta Seguimiento y Alertas. Para reasignar o finalizar por excepción, registra el motivo en el trabajo correspondiente.',
      ],
    ],
  },
};
