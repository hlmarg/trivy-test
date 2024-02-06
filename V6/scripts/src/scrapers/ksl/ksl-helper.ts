import { ScrapedVehicle } from 'src/shared/interfaces';

export function processVehicleData(data): ScrapedVehicle {
  if (data.titleType === 'Rebuilt/Reconstructed Title') {
    return null;
  }

  return {
    link: `https://cars.ksl.com/listing/${data.id}`,
    askingPrice: Number(data.price),
    vin: data.vin || null,
    model: data.model,
    make: data.make,
    mileage: data.mileage,
    year: data.makeYear,
    listingDate: new Date(data.displayTime * 1000).toISOString(),
    sellerName: data.firstName,
    trim: data.trim,
    images: data.photo.map((photo) => photo?.id || JSON.parse(photo)?.id),
    title: `${data.makeYear} ${data.make} ${data.model} ${data.trim || ''}`.trim(),
    originalTitle: `${data.makeYear} ${data.make} ${data.model}${data.trim || ''}`.trim(),
    description: `City: ${data.city} | Body: ${data.body} | ${data.paint?.join(' ')}`,
    sellerEmail: data.email || '',
    sellerPhone: data.primaryPhone || '',
    vehicleOriginalId: data.id,
    suspectedDealer: false,
    totalOwners: 1,
  };
}
