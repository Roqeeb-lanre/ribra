import { Schema, model } from 'mongoose';

/**
 * Every successful charge, once. The unique reference makes webhook retries
 * and the "verify after redirect" call safe to process more than once.
 */
const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true }, // in kobo
    currency: { type: String, required: true },
    planCode: { type: String },
    paidAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const PaymentModel = model('Payment', paymentSchema);
