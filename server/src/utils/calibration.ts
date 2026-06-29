import * as math from 'mathjs';
import prisma from './prisma';

export async function calibrateVehicle(vehicleId: string) {
  // Fetch the last 10 logs
  const logs = await prisma.refuelLog.findMany({
    where: { vehicleId },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  // Need at least 3 logs to run a meaningful regression
  if (logs.length < 3) {
    return null;
  }

  // Dependent variable Y: Actual liters pumped
  const Y = logs.map(log => [log.litersPumped]);

  // Independent variables X: [Predicted City Burn, Predicted Highway Burn]
  const X = logs.map(log => [log.predictedCityBurn, log.predictedHighwayBurn]);

  try {
    // Calculate OLS: B = (X^T * X)^-1 * X^T * Y
    const X_matrix = math.matrix(X);
    const Y_matrix = math.matrix(Y);

    const X_transpose = math.transpose(X_matrix);
    const X_T_X = math.multiply(X_transpose, X_matrix);
    const X_T_X_inv = math.inv(X_T_X);
    const X_T_Y = math.multiply(X_transpose, Y_matrix);

    // Coefficients [k_city, k_highway]
    const B = math.multiply(X_T_X_inv, X_T_Y) as math.Matrix;
    const coefficients = B.toArray() as number[][];

    let kCity = coefficients[0][0];
    let kHighway = coefficients[1][0];

    // Constrain coefficients to reasonable bounds to avoid wild factors
    kCity = Math.max(0.5, Math.min(kCity, 2.0));
    kHighway = Math.max(0.5, Math.min(kHighway, 2.0));

    // Update vehicle
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        kCity,
        kHighway,
      },
    });

    return updatedVehicle;
  } catch (error) {
    console.error('Calibration Error:', error);
    return null;
  }
}
