from database import SessionLocal
import models
import traceback

def seed():
    try:
        db = SessionLocal()
        farmer = models.FarmerUser(
            full_name='Ramesh Kumar',
            email='ramesh2@farm.in',
            mobile='9876543210',
            password_hash='farmer123',
            role='farmer',
            profile_complete=True
        )
        admin = models.FarmerUser(
            full_name='Admin Officer',
            email='admin@agriportal.gov.in',
            mobile='9999999999',
            password_hash='admin123',
            role='admin',
            profile_complete=True
        )
        if not db.query(models.FarmerUser).filter_by(email='admin@agriportal.gov.in').first():
            db.add(admin)
        if not db.query(models.FarmerUser).filter_by(email='ramesh2@farm.in').first():
            db.add(farmer)
        db.commit()
        print('Users Seeded!')
    except Exception as e:
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    seed()
