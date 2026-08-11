import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export const AudienceSection: React.FC = () => {
  const categories = [
    {
      title: 'Roommates & Flatmates',
      subtitle: 'Shared Apartment Living',
      img: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80',
      items: ['House rent & security deposit', 'Electricity, gas & water bills', 'Cook, maid & cleaning supplies', 'Weekly grocery runs'],
    },
    {
      title: 'Hostel Students',
      subtitle: 'Campus & Dorm Life',
      img: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=800&q=80',
      items: ['Mess bills & canteen tabs', 'Late-night food orders', 'Lab supplies & printouts', 'Weekend student outings'],
    },
    {
      title: 'PG Residents',
      subtitle: 'Paying Guest Accommodation',
      img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
      items: ['Monthly maintenance & Wi-Fi', 'Common kitchen appliances', 'Daily milk & water cans', 'Shared TV/OTT accounts'],
    },
    {
      title: 'Families',
      subtitle: 'Joint Households',
      img: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80',
      items: ['Shared monthly groceries', 'Utility & recurring bills', 'Family celebrations & events', 'Combined household purchases'],
    },
    {
      title: 'Friends & Trips',
      subtitle: 'Vacations & Weekend Outings',
      img: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
      items: ['Goa & Manali trip bookings', 'Cab rentals & petrol costs', 'Group dinners & birthday gifts', 'Activity & concert tickets'],
    },
  ];

  return (
    <section id="who-its-for" className="py-20 bg-[#FAF9F6] text-slate-900 border-b border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 inline-block">
            Target Audience
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans text-slate-900">
            Built for people who share expenses.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Whether you share a flat in Bangalore, a hostel room in Kota, or a weekend road trip with college friends.
          </p>
        </div>

        {/* Asymmetric Photographic Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className={`rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-md hover:shadow-xl transition-all group ${
                idx === 0 ? 'lg:col-span-2' : ''
              }`}
            >
              {/* Photo Banner */}
              <div className="relative h-48 sm:h-56 overflow-hidden">
                <img
                  src={cat.img}
                  alt={cat.title}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-5">
                  <div className="text-white">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                      {cat.subtitle}
                    </span>
                    <h3 className="text-xl font-extrabold mt-1 font-sans">{cat.title}</h3>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-5 space-y-2 text-xs text-slate-700">
                {cat.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
