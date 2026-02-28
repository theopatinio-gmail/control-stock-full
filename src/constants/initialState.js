export const INITIAL_STATE = {
    stockEntries: [],
    sales: [],
    products: [] // Cached product names for the dropdown
};

// Data Structure Examples:
// stockEntries: [
//   {
//     id: 'uuid',
//     product: 'Remera Cotton',
//     fechaEnvio: '2024-01-06',
//     variants: [{ talle: 'M', color: 'Negro', cantidad: 10 }]
//   }
// ]
// sales: [
//   {
//     id: 'uuid',
//     fechaVenta: '2024-01-07',
//     product: 'Remera Cotton',
//     talle: 'M',
//     color: 'Negro',
//     opNumber: '123456789'
//   }
// ]
