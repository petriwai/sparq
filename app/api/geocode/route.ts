import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, lat, lng, userLat, userLng } = body

    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY not configured')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Default to Springfield, IL if no user location provided
    const biasLat = userLat || 39.7817
    const biasLng = userLng || -89.6501

    // 1. REVERSE GEOCODING (Coordinates -> Address)
    if (lat && lng && !address) {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      )
      const data = await response.json()

      if (data.status === 'OK' && data.results && data.results[0]) {
        return NextResponse.json({
          success: true,
          address: data.results[0].formatted_address
        })
      }
      return NextResponse.json({ success: false, message: 'Location not found' })
    }

    // 2. FORWARD SEARCH (Address OR Place -> Coordinates)
    if (address) {
      // Check if address already contains a city/state
      const hasLocation = /springfield|illinois|IL|chicago/i.test(address)
      
      // If user just typed a business name without location, append Springfield IL
      const searchQuery = hasLocation ? address : `${address} Springfield IL`
      
      // STRATEGY A: Try strict Geocoding first (Best for "123 Main St")
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`
      const geoResponse = await fetch(geoUrl)
      const geoData = await geoResponse.json()

      // Check if it's a specific address (not a business name)
      if (geoData.status === 'OK' && geoData.results && geoData.results[0]) {
        const result = geoData.results[0]
        // If it's a street address type, return it directly
        const isStreetAddress = result.types?.some((t: string) => 
          ['street_address', 'premise', 'subpremise', 'route'].includes(t)
        )
        if (isStreetAddress) {
          return NextResponse.json({
            success: true,
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
            formatted_address: result.formatted_address,
            source: 'geocoding'
          })
        }
      }

      // STRATEGY B: Use Places Text Search for businesses
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&location=${biasLat},${biasLng}&radius=25000&key=${apiKey}`
      const placesResponse = await fetch(placesUrl)
      const placesData = await placesResponse.json()

      if (placesData.status === 'OK' && placesData.results && placesData.results.length > 0) {
        // Filter results to only include those within ~50km of Springfield
        const nearbyResults = placesData.results.filter((result: any) => {
          const resultLat = result.geometry.location.lat
          const resultLng = result.geometry.location.lng
          // Simple distance check (roughly 50km)
          const latDiff = Math.abs(resultLat - biasLat)
          const lngDiff = Math.abs(resultLng - biasLng)
          return latDiff < 0.5 && lngDiff < 0.5
        })

        const resultsToUse = nearbyResults.length > 0 ? nearbyResults : placesData.results.slice(0, 5)
        
        // Return multiple results for user to choose from
        const results = resultsToUse.slice(0, 5).map((result: any) => ({
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formatted_address: result.formatted_address,
          name: result.name
        }))

        // If only one result, return it directly
        if (results.length === 1) {
          return NextResponse.json({
            success: true,
            lat: results[0].lat,
            lng: results[0].lng,
            formatted_address: results[0].formatted_address,
            name: results[0].name,
            source: 'places'
          })
        }

        // Multiple results - let frontend show picker
        return NextResponse.json({
          success: true,
          multiple: true,
          results,
          source: 'places'
        })
      }

      // Fallback: return geocoding result if we have one
      if (geoData.status === 'OK' && geoData.results && geoData.results[0]) {
        const result = geoData.results[0]
        return NextResponse.json({
          success: true,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formatted_address: result.formatted_address,
          source: 'geocoding'
        })
      }

      // If both failed
      return NextResponse.json({
        success: false,
        error: geoData.status || 'NOT_FOUND',
        message: 'Address or place not found'
      })
    }

    return NextResponse.json({ error: 'Missing address or coordinates' }, { status: 400 })

  } catch (error) {
    console.error('Geocoding error:', error)
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
  }
}
